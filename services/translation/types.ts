import type { SourceLanguage } from "@/lib/domain";

/**
 * Contrato de tradução.
 *
 * Existe para que trocar de provedor (DeepL, Google, um modelo local) seja
 * escrever uma classe nova, e não reescrever a aplicação
 * (instrucoes.md secao 5).
 *
 * O formato é em **lote com contexto**, não frase a frase, porque legenda é
 * discurso contínuo: "That's what I meant" só se traduz direito sabendo o que
 * veio antes. O provedor recebe as frases vizinhas para entender, mas devolve
 * uma tradução por segmento — o mapeamento 1:1 é obrigatório, senão o
 * flashcard sai desalinhado do vídeo.
 */

export interface TranslationItem {
  /** Identificador estável dentro do lote (usamos o índice do segmento). */
  id: number;
  text: string;
}

export interface TranslationContext {
  sourceLang: SourceLanguage;
  targetLang: string;
  /** Frases anteriores ao lote, só para dar contexto. Não são traduzidas. */
  before: string[];
  /** Frases seguintes ao lote, mesma função. */
  after: string[];
  /** Título do vídeo — ajuda em termos e nomes próprios. */
  videoTitle?: string;
}

export interface TranslationResult {
  id: number;
  text: string;
}

export interface TranslationProvider {
  /** Nome curto, gravado em cada tradução para rastreabilidade. */
  readonly name: string;
  /** Modelo/versão usada, quando faz sentido. */
  readonly model: string | null;

  /**
   * Traduz um lote. Deve devolver exatamente um resultado por item recebido,
   * com o mesmo `id`. Lançar exceção é aceitável: quem chama trata e reagenda.
   */
  translateBatch(
    items: TranslationItem[],
    context: TranslationContext,
  ): Promise<TranslationResult[]>;
}

/** Erro de tradução com mensagem já pronta para a tela. */
export class TranslationError extends Error {
  /** true quando faz sentido tentar de novo (rede, limite de uso, 5xx). */
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "TranslationError";
    this.retryable = options.retryable;
  }
}
