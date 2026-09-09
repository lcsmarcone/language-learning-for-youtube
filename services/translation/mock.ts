import type {
  TranslationContext,
  TranslationItem,
  TranslationProvider,
  TranslationResult,
} from "./types";

/**
 * Provedor falso, para testes e para rodar a aplicação sem chave de API.
 *
 * Não tenta parecer tradução de verdade: prefixa o texto de forma óbvia, para
 * ninguém confundir saída de teste com conteúdo real numa captura de tela.
 */
export class MockTranslationProvider implements TranslationProvider {
  readonly name = "mock";
  readonly model = null;

  /** Permite simular falha em testes. */
  constructor(
    private readonly options: {
      failOnce?: boolean;
      dropIds?: number[];
      onBatch?: (items: TranslationItem[], context: TranslationContext) => void;
    } = {},
  ) {}

  private failuresLeft = this.options.failOnce ? 1 : 0;

  async translateBatch(
    items: TranslationItem[],
    context: TranslationContext,
  ): Promise<TranslationResult[]> {
    this.options.onBatch?.(items, context);

    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error("falha simulada do provedor");
    }

    return items
      .filter((item) => !this.options.dropIds?.includes(item.id))
      .map((item) => ({ id: item.id, text: `[${context.targetLang}] ${item.text}` }));
  }
}
