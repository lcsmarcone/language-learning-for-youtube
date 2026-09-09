import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { LANGUAGE_LABELS } from "@/lib/domain";
import {
  TranslationError,
  type TranslationContext,
  type TranslationItem,
  type TranslationProvider,
  type TranslationResult,
} from "./types";

/**
 * Tradutor baseado no Claude.
 *
 * Por que um LLM e não uma API de tradução tradicional (instrucoes.md secao 5):
 * o público aqui é alguém aprendendo o idioma, então "correto" não basta — a
 * frase em português precisa soar como alguém falaria. Fala coloquial, gíria,
 * ironia e frases cortadas no meio são o pão de cada dia de uma legenda, e é
 * exatamente onde tradutor por frase isolada erra feio.
 *
 * A saída é **estruturada** (`output_config.format` com schema Zod): o modelo
 * é obrigado a devolver um item por segmento, com o id de volta. Isso elimina
 * a classe inteira de bug de "o modelo juntou duas falas numa só" — que
 * desalinharia a legenda do vídeo e estragaria os flashcards.
 */

const responseSchema = z.object({
  translations: z
    .array(
      z.object({
        id: z.number().int(),
        text: z.string(),
      }),
    )
    .describe("Uma entrada para cada segmento recebido, na mesma ordem."),
});

const DEFAULT_MODEL = "claude-sonnet-5";

export class AnthropicTranslationProvider implements TranslationProvider {
  readonly name = "anthropic";
  readonly model: string;

  private readonly client: Anthropic;

  constructor(options: { apiKey: string; model?: string }) {
    this.model = options.model || DEFAULT_MODEL;
    this.client = new Anthropic({
      apiKey: options.apiKey,
      // O SDK já repete em 429/5xx/erro de conexão. Duas tentativas cobrem o
      // caso comum sem transformar uma indisponibilidade real em espera longa.
      maxRetries: 2,
      timeout: 120_000,
    });
  }

  async translateBatch(
    items: TranslationItem[],
    context: TranslationContext,
  ): Promise<TranslationResult[]> {
    if (items.length === 0) return [];

    const sourceLabel = LANGUAGE_LABELS[context.sourceLang] ?? context.sourceLang;
    const targetLabel =
      LANGUAGE_LABELS[context.targetLang as "pt-BR"] ?? context.targetLang;

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 8000,
        system: buildSystemPrompt(sourceLabel, targetLabel),
        // Tradução de legenda é trabalho de língua, não de raciocínio longo.
        // Esforço baixo mantém a qualidade e evita pagar (e esperar) por
        // deliberação desnecessária em centenas de lotes.
        output_config: {
          effort: "low",
          format: zodOutputFormat(responseSchema),
        },
        messages: [
          { role: "user", content: buildUserPrompt(items, context) },
        ],
      });

      const parsed = response.parsed_output;
      if (!parsed) {
        throw new TranslationError(
          "O tradutor devolveu uma resposta em formato inesperado.",
          { retryable: true },
        );
      }

      return alignResults(items, parsed.translations);
    } catch (error) {
      throw toTranslationError(error);
    }
  }
}

function buildSystemPrompt(sourceLabel: string, targetLabel: string): string {
  return [
    `Você traduz legendas de vídeo de ${sourceLabel} para ${targetLabel}.`,
    "",
    "Quem vai ler está aprendendo o idioma original assistindo ao vídeo, com a legenda original e a sua tradução lado a lado.",
    "",
    "Como traduzir:",
    "- Escreva como uma pessoa falaria, não como um manual. Prefira a construção natural à literal.",
    "- Use o contexto das falas vizinhas para resolver ambiguidade, pronome sem referente e frase cortada.",
    "- Mantenha o registro: gíria vira gíria, formal vira formal, palavrão vira palavrão.",
    "- Preserve nomes próprios, marcas e números como estão.",
    "- Mantenha a pontuação de fala (reticências, travessão) quando ela marca hesitação ou interrupção.",
    "- Se um segmento termina no meio de uma frase, traduza só o pedaço dele; não puxe texto do segmento seguinte.",
    "- Não explique, não comente, não adicione nem remova informação.",
    "",
    "Regra inegociável: devolva exatamente uma tradução para cada segmento recebido, com o mesmo id. Os segmentos são sincronizados com o vídeo — juntar ou separar falas quebra a sincronia.",
  ].join("\n");
}

function buildUserPrompt(
  items: TranslationItem[],
  context: TranslationContext,
): string {
  const parts: string[] = [];

  if (context.videoTitle) {
    parts.push(`Vídeo: ${context.videoTitle}`, "");
  }

  if (context.before.length > 0) {
    parts.push(
      "Falas anteriores (apenas contexto, NÃO traduza):",
      ...context.before.map((text) => `- ${text}`),
      "",
    );
  }

  parts.push(
    "Segmentos para traduzir:",
    ...items.map((item) => `[${item.id}] ${item.text}`),
  );

  if (context.after.length > 0) {
    parts.push(
      "",
      "Falas seguintes (apenas contexto, NÃO traduza):",
      ...context.after.map((text) => `- ${text}`),
    );
  }

  return parts.join("\n");
}

/**
 * Garante o mapeamento 1:1 mesmo que o modelo troque a ordem ou repita um id.
 *
 * O schema já obriga a forma da resposta, mas não garante que os ids batem com
 * os enviados. Um id faltando vira erro repetível — é melhor tentar de novo do
 * que gravar tradução em segmento errado, que é um erro silencioso e o usuário
 * só descobre quando o flashcard sai trocado.
 */
function alignResults(
  items: TranslationItem[],
  received: Array<{ id: number; text: string }>,
): TranslationResult[] {
  const byId = new Map<number, string>();
  for (const entry of received) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry.text);
  }

  const missing: number[] = [];
  const aligned = items.map((item) => {
    const text = byId.get(item.id);
    if (text === undefined || text.trim().length === 0) {
      missing.push(item.id);
      return { id: item.id, text: "" };
    }
    return { id: item.id, text: text.trim() };
  });

  if (missing.length > 0) {
    throw new TranslationError(
      `O tradutor não devolveu ${missing.length} de ${items.length} segmentos do bloco.`,
      { retryable: true },
    );
  }

  return aligned;
}

function toTranslationError(error: unknown): TranslationError {
  if (error instanceof TranslationError) return error;

  if (error instanceof Anthropic.AuthenticationError) {
    return new TranslationError(
      "A chave da API da Anthropic foi recusada. Confira ANTHROPIC_API_KEY no arquivo .env.",
      { retryable: false, cause: error },
    );
  }

  if (error instanceof Anthropic.PermissionDeniedError) {
    return new TranslationError(
      "Sua chave não tem permissão para usar este modelo.",
      { retryable: false, cause: error },
    );
  }

  if (error instanceof Anthropic.RateLimitError) {
    return new TranslationError(
      "O limite de uso da API foi atingido. A tradução continua em instantes.",
      { retryable: true, cause: error },
    );
  }

  if (error instanceof Anthropic.BadRequestError) {
    return new TranslationError(
      "A API recusou o pedido de tradução deste bloco.",
      { retryable: false, cause: error },
    );
  }

  if (error instanceof Anthropic.APIConnectionError) {
    return new TranslationError(
      "Não foi possível falar com a API de tradução. Verifique sua conexão.",
      { retryable: true, cause: error },
    );
  }

  if (error instanceof Anthropic.APIError) {
    return new TranslationError(
      `A API de tradução respondeu com erro ${error.status ?? ""}.`.trim(),
      { retryable: (error.status ?? 500) >= 500, cause: error },
    );
  }

  return new TranslationError("Falha inesperada ao traduzir este bloco.", {
    retryable: true,
    cause: error,
  });
}
