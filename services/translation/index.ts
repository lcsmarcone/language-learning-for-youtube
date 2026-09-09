import { AnthropicTranslationProvider } from "./anthropic";
import { MockTranslationProvider } from "./mock";
import { TranslationError, type TranslationProvider } from "./types";

export * from "./types";
export * from "./chunk";
export { MockTranslationProvider } from "./mock";
export { AnthropicTranslationProvider } from "./anthropic";

/**
 * Escolhe o provedor a partir do ambiente.
 *
 * **Só roda no servidor.** A chave nunca é enviada ao navegador
 * (instrucoes.md secao 17); se este módulo fosse importado por um componente
 * de cliente, o build do Next quebraria — que é o comportamento desejado.
 */
export function getTranslationProvider(): TranslationProvider {
  const configured = (process.env.TRANSLATION_PROVIDER ?? "anthropic").toLowerCase();

  if (configured === "mock") {
    return new MockTranslationProvider();
  }

  if (configured === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new TranslationError(
        "A tradução não está configurada: falta ANTHROPIC_API_KEY no arquivo .env.",
        { retryable: false },
      );
    }
    return new AnthropicTranslationProvider({
      apiKey,
      model: process.env.ANTHROPIC_MODEL,
    });
  }

  throw new TranslationError(
    `Provedor de tradução desconhecido: "${configured}". Use "anthropic" ou "mock".`,
    { retryable: false },
  );
}

/** Diz se dá para traduzir, sem lançar exceção — usado pela UI. */
export function isTranslationConfigured(): boolean {
  try {
    getTranslationProvider();
    return true;
  } catch {
    return false;
  }
}
