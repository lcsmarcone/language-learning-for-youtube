/**
 * Seleção de texto na transcrição — o coração da etapa (instrucoes.md secao 6).
 *
 * A decisão central deste arquivo é o que NÃO fazemos: **não inventamos
 * correspondência palavra a palavra entre original e tradução**. Ela não existe
 * de forma confiável — "I have been studying" vira "eu estudo", quatro palavras
 * viram duas, e alinhar isso por posição produziria destaques errados com cara
 * de certos.
 *
 * O que fazemos, conforme as instruções mandam:
 * - a seleção no original é preservada **exatamente**, por deslocamento de
 *   caractere;
 * - o lado oposto destaca o **segmento inteiro** correspondente.
 *
 * Assim o usuário sempre vê a frase certa do outro lado, e nunca um recorte
 * inventado.
 */

/** De qual lado do bloco a seleção foi feita. */
export type SelectionSide = "original" | "translation";

/** Seleção capturada da tela, ainda não salva. */
export interface SelectionSnapshot {
  side: SelectionSide;
  startSegmentId: string;
  startIndex: number;
  startOffset: number;
  endSegmentId: string;
  endIndex: number;
  endOffset: number;
  /** Texto exatamente como selecionado. */
  quotedText: string;
  /** Ids de todos os segmentos tocados, do início ao fim. */
  segmentIds: string[];
}

/** Destaque já salvo, como volta do servidor. */
export interface StoredHighlight {
  id: string;
  startSegmentId: string;
  startIndex: number;
  startOffset: number;
  endSegmentId: string;
  endIndex: number;
  endOffset: number;
  quotedText: string;
  translatedText: string | null;
}

/** Trecho a marcar dentro do texto de um bloco. */
export interface MarkRange {
  start: number;
  end: number;
}

/**
 * Quais pedaços do texto de um bloco pertencem a destaques salvos.
 *
 * Um destaque pode atravessar vários blocos: o primeiro é marcado do
 * deslocamento inicial até o fim, os do meio inteiros, e o último do começo até
 * o deslocamento final.
 */
export function segmentMarkRanges(
  segment: { id: string; index: number; text: string },
  highlights: readonly Pick<
    StoredHighlight,
    "startSegmentId" | "startIndex" | "startOffset" | "endSegmentId" | "endIndex" | "endOffset"
  >[],
): MarkRange[] {
  const ranges: MarkRange[] = [];
  const length = segment.text.length;

  for (const highlight of highlights) {
    const isFirst = highlight.startSegmentId === segment.id;
    const isLast = highlight.endSegmentId === segment.id;
    const isMiddle =
      segment.index > highlight.startIndex && segment.index < highlight.endIndex;

    if (isFirst && isLast) {
      ranges.push({
        start: clamp(highlight.startOffset, 0, length),
        end: clamp(highlight.endOffset, 0, length),
      });
    } else if (isFirst) {
      ranges.push({ start: clamp(highlight.startOffset, 0, length), end: length });
    } else if (isLast) {
      ranges.push({ start: 0, end: clamp(highlight.endOffset, 0, length) });
    } else if (isMiddle) {
      ranges.push({ start: 0, end: length });
    }
  }

  return mergeRanges(ranges.filter((range) => range.end > range.start));
}

/** Une trechos sobrepostos ou encostados, para não gerar `<mark>` aninhado. */
export function mergeRanges(ranges: MarkRange[]): MarkRange[] {
  if (ranges.length <= 1) return ranges;

  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MarkRange[] = [sorted[0]];

  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

export interface TextPiece {
  text: string;
  marked: boolean;
}

/**
 * Divide o texto em pedaços marcados e não marcados, na ordem.
 *
 * Existe como função pura para o componente só renderizar — e para o teste
 * conseguir provar que nenhum caractere se perde nem se duplica no caminho.
 */
export function splitByRanges(text: string, ranges: MarkRange[]): TextPiece[] {
  const merged = mergeRanges(
    ranges
      .map((range) => ({
        start: clamp(range.start, 0, text.length),
        end: clamp(range.end, 0, text.length),
      }))
      .filter((range) => range.end > range.start),
  );

  if (merged.length === 0) return [{ text, marked: false }];

  const pieces: TextPiece[] = [];
  let cursor = 0;

  for (const range of merged) {
    if (range.start > cursor) {
      pieces.push({ text: text.slice(cursor, range.start), marked: false });
    }
    pieces.push({ text: text.slice(range.start, range.end), marked: true });
    cursor = range.end;
  }

  if (cursor < text.length) {
    pieces.push({ text: text.slice(cursor), marked: false });
  }

  return pieces;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Leitura da seleção do navegador
// ---------------------------------------------------------------------------

/** Atributos que ligam um nó do DOM ao segmento e ao lado correspondentes. */
export const SEGMENT_ATTR = "data-segment-id";
export const SEGMENT_INDEX_ATTR = "data-segment-index";
export const SIDE_ATTR = "data-role";

/**
 * Deslocamento em caracteres de um ponto do DOM dentro de um elemento.
 *
 * Não dá para usar `range.startOffset` direto: assim que um destaque é
 * renderizado, o texto do bloco deixa de ser um nó único e passa a ser vários
 * (`<mark>` no meio). Aqui somamos o comprimento de todos os nós de texto que
 * vêm antes, o que funciona igual com ou sem destaques.
 */
export function textOffsetWithin(
  root: HTMLElement,
  node: Node,
  offsetInNode: number,
): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;

  while (walker.nextNode()) {
    const current = walker.currentNode;
    if (current === node) return total + offsetInNode;
    total += current.textContent?.length ?? 0;
  }

  // O ponto não está num nó de texto (seleção que termina na borda do
  // elemento): o fim do texto é a melhor aproximação.
  return total;
}

/** Sobe no DOM até o elemento que representa um lado (original ou tradução). */
function closestSide(node: Node | null): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement) {
      const role = current.getAttribute(SIDE_ATTR);
      if (role === "original" || role === "translation") return current;
    }
    current = current.parentNode;
  }
  return null;
}

/** Sobe no DOM até o bloco da legenda. */
function closestSegment(node: Node | null): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.hasAttribute(SEGMENT_ATTR)) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Lê a seleção atual do navegador e a converte num objeto persistível.
 *
 * Devolve `null` quando não há nada útil: seleção vazia, clique simples, ou
 * seleção que mistura original e tradução — misturar os dois lados não produz
 * um trecho com sentido, então é melhor ignorar do que salvar algo estranho.
 */
export function readSelection(
  segmentsById: ReadonlyMap<string, SelectableSegment>,
): SelectionSnapshot | null {
  if (typeof window === "undefined") return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  if (selection.toString().trim().length === 0) return null;

  const range = selection.getRangeAt(0);

  const startSide = closestSide(range.startContainer);
  const endSide = closestSide(range.endContainer);
  if (!startSide || !endSide) return null;

  const side = startSide.getAttribute(SIDE_ATTR) as SelectionSide;
  if (endSide.getAttribute(SIDE_ATTR) !== side) return null;

  const startSegment = closestSegment(startSide);
  const endSegment = closestSegment(endSide);
  if (!startSegment || !endSegment) return null;

  const startSegmentId = startSegment.getAttribute(SEGMENT_ATTR);
  const endSegmentId = endSegment.getAttribute(SEGMENT_ATTR);
  if (!startSegmentId || !endSegmentId) return null;

  const startInfo = segmentsById.get(startSegmentId);
  const endInfo = segmentsById.get(endSegmentId);
  if (!startInfo || !endInfo) return null;

  const startOffset = textOffsetWithin(
    startSide,
    range.startContainer,
    range.startOffset,
  );
  const endOffset = textOffsetWithin(endSide, range.endContainer, range.endOffset);

  // Arrastar da direita para a esquerda já chega normalizado, porque o Range
  // do navegador sempre vem em ordem de documento. A checagem abaixo é uma
  // rede de segurança barata para quem chamar esta função com um Range montado
  // à mão.
  const forward =
    startInfo.index < endInfo.index ||
    (startInfo.index === endInfo.index && startOffset <= endOffset);

  const bounds = forward
    ? {
        startSegmentId,
        startIndex: startInfo.index,
        startOffset,
        endSegmentId,
        endIndex: endInfo.index,
        endOffset,
      }
    : {
        startSegmentId: endSegmentId,
        startIndex: endInfo.index,
        startOffset: endOffset,
        endSegmentId: startSegmentId,
        endIndex: startInfo.index,
        endOffset: startOffset,
      };

  const segmentIds = collectSegmentIds(
    segmentsById,
    bounds.startIndex,
    bounds.endIndex,
  );

  const quotedText = quoteFromSegments(segmentsById, side, bounds);
  if (quotedText.length === 0) return null;

  return { side, ...bounds, quotedText, segmentIds };
}

/** O que a tela mostra de cada bloco, de cada lado. */
export interface SelectableSegment {
  index: number;
  text: string;
  translatedText?: string | null;
}

/**
 * Monta o texto selecionado a partir dos dados, e não de
 * `selection.toString()`.
 *
 * Isso não é preciosismo: quando a seleção cruza blocos, o texto do navegador
 * vem com a **tradução do meio junto** — o original e a tradução são vizinhos
 * no DOM, então uma seleção que vai do bloco 7 ao 8 arrasta o português do
 * bloco 7 no caminho. Um flashcard nascido daí teria português na frente em
 * inglês.
 *
 * Reconstruindo pelos deslocamentos, o texto salvo é exatamente o mesmo que
 * será destacado ao reabrir o vídeo.
 */
function quoteFromSegments(
  segmentsById: ReadonlyMap<string, SelectableSegment>,
  side: SelectionSide,
  bounds: {
    startIndex: number;
    startOffset: number;
    endIndex: number;
    endOffset: number;
  },
): string {
  const inRange = [...segmentsById.values()]
    .filter(
      (segment) =>
        segment.index >= bounds.startIndex && segment.index <= bounds.endIndex,
    )
    .sort((a, b) => a.index - b.index);

  const pieces: string[] = [];

  for (const segment of inRange) {
    const full =
      side === "original" ? segment.text : (segment.translatedText ?? "");
    if (full.length === 0) continue;

    const from = segment.index === bounds.startIndex ? bounds.startOffset : 0;
    const to = segment.index === bounds.endIndex ? bounds.endOffset : full.length;

    const piece = full.slice(Math.max(0, from), Math.min(full.length, to));
    if (piece.trim().length > 0) pieces.push(piece.trim());
  }

  return pieces.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** Ids de todos os blocos entre dois índices, inclusive. */
function collectSegmentIds(
  segmentsById: ReadonlyMap<string, SelectableSegment>,
  startIndex: number,
  endIndex: number,
): string[] {
  const ids: string[] = [];
  for (const [id, info] of segmentsById) {
    if (info.index >= startIndex && info.index <= endIndex) ids.push(id);
  }
  return ids;
}
