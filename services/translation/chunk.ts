import type { NormalizedSegment } from "@/lib/domain";

/**
 * Divisão da legenda em blocos de tradução.
 *
 * Dois números governam esta etapa, e os dois são compromissos:
 *
 * - **Tamanho do bloco**: bloco grande economiza chamadas, mas atrasa o
 *   primeiro resultado aparecer na tela e faz uma falha custar mais caro
 *   (perde-se o bloco inteiro).
 * - **Contexto**: as frases vizinhas são enviadas para o modelo entender
 *   pronomes e frases cortadas, mas não são traduzidas de volta. Custam
 *   tokens; poucas resolvem quase todos os casos.
 */

/** Segmentos traduzidos por chamada. */
export const CHUNK_SIZE = 20;

/** Frases vizinhas enviadas antes e depois, só como contexto. */
export const CONTEXT_SIZE = 2;

export interface TranslationChunk<T extends { text: string }> {
  /** Índice do bloco, usado no progresso. */
  index: number;
  /** Segmentos que serão traduzidos. */
  items: T[];
  /** Falas anteriores, apenas contexto. */
  before: string[];
  /** Falas seguintes, apenas contexto. */
  after: string[];
}

/**
 * Quebra a lista em blocos com contexto.
 *
 * O contexto vem dos segmentos **originais** vizinhos — inclusive os que já
 * estavam traduzidos e por isso não entram no bloco. É o que mantém a
 * continuidade quando só uma parte da legenda precisa ser traduzida.
 */
export function buildChunks<T extends Pick<NormalizedSegment, "text">>(
  toTranslate: T[],
  allSegments: readonly { text: string }[],
  positionOf: (item: T) => number,
  options: { chunkSize?: number; contextSize?: number } = {},
): TranslationChunk<T>[] {
  const chunkSize = options.chunkSize ?? CHUNK_SIZE;
  const contextSize = options.contextSize ?? CONTEXT_SIZE;

  const chunks: TranslationChunk<T>[] = [];

  for (let i = 0; i < toTranslate.length; i += chunkSize) {
    const items = toTranslate.slice(i, i + chunkSize);
    if (items.length === 0) continue;

    const firstPosition = positionOf(items[0]);
    const lastPosition = positionOf(items[items.length - 1]);

    const before = allSegments
      .slice(Math.max(0, firstPosition - contextSize), firstPosition)
      .map((segment) => segment.text);

    const after = allSegments
      .slice(lastPosition + 1, lastPosition + 1 + contextSize)
      .map((segment) => segment.text);

    chunks.push({ index: chunks.length, items, before, after });
  }

  return chunks;
}
