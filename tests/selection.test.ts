import { describe, expect, it } from "vitest";
import {
  mergeRanges,
  segmentMarkRanges,
  splitByRanges,
  type StoredHighlight,
} from "@/lib/selection";

const segments = [
  { id: "s0", index: 0, text: "All right, so here we are." },
  { id: "s1", index: 1, text: "In front of the elephants." },
  { id: "s2", index: 2, text: "And that's cool." },
];

function highlight(partial: Partial<StoredHighlight>): StoredHighlight {
  return {
    id: "h",
    startSegmentId: "s0",
    startIndex: 0,
    startOffset: 0,
    endSegmentId: "s0",
    endIndex: 0,
    endOffset: 9,
    quotedText: "All right",
    translatedText: null,
    ...partial,
  };
}

describe("splitByRanges", () => {
  it("devolve o texto inteiro quando não há destaque", () => {
    expect(splitByRanges("abcdef", [])).toEqual([
      { text: "abcdef", marked: false },
    ]);
  });

  it("marca só o trecho pedido", () => {
    expect(splitByRanges("abcdef", [{ start: 2, end: 4 }])).toEqual([
      { text: "ab", marked: false },
      { text: "cd", marked: true },
      { text: "ef", marked: false },
    ]);
  });

  it("marca do começo e até o fim sem sobrar pedaço vazio", () => {
    expect(splitByRanges("abcdef", [{ start: 0, end: 3 }])).toEqual([
      { text: "abc", marked: true },
      { text: "def", marked: false },
    ]);
    expect(splitByRanges("abcdef", [{ start: 3, end: 6 }])).toEqual([
      { text: "abc", marked: false },
      { text: "def", marked: true },
    ]);
  });

  it("nunca perde nem duplica caractere, com vários destaques", () => {
    const text = "uma frase razoavelmente comprida para testar";
    const ranges = [
      { start: 4, end: 9 },
      { start: 24, end: 32 },
      { start: 0, end: 3 },
    ];

    const pieces = splitByRanges(text, ranges);

    expect(pieces.map((piece) => piece.text).join("")).toBe(text);
  });

  it("ignora trechos fora dos limites do texto", () => {
    expect(splitByRanges("abc", [{ start: 10, end: 20 }])).toEqual([
      { text: "abc", marked: false },
    ]);
    expect(splitByRanges("abc", [{ start: -5, end: 2 }])).toEqual([
      { text: "ab", marked: true },
      { text: "c", marked: false },
    ]);
  });

  it("ignora trecho de tamanho zero", () => {
    expect(splitByRanges("abc", [{ start: 1, end: 1 }])).toEqual([
      { text: "abc", marked: false },
    ]);
  });
});

describe("mergeRanges", () => {
  it("une trechos sobrepostos", () => {
    expect(
      mergeRanges([
        { start: 0, end: 5 },
        { start: 3, end: 8 },
      ]),
    ).toEqual([{ start: 0, end: 8 }]);
  });

  it("une trechos encostados", () => {
    expect(
      mergeRanges([
        { start: 0, end: 3 },
        { start: 3, end: 6 },
      ]),
    ).toEqual([{ start: 0, end: 6 }]);
  });

  it("mantém trechos separados", () => {
    expect(
      mergeRanges([
        { start: 5, end: 8 },
        { start: 0, end: 2 },
      ]),
    ).toEqual([
      { start: 0, end: 2 },
      { start: 5, end: 8 },
    ]);
  });
});

describe("segmentMarkRanges", () => {
  it("marca o trecho exato quando o destaque cabe num bloco só", () => {
    const ranges = segmentMarkRanges(segments[0], [
      highlight({ startOffset: 4, endOffset: 9 }),
    ]);
    expect(ranges).toEqual([{ start: 4, end: 9 }]);
  });

  it("marca do deslocamento até o fim no primeiro bloco de um destaque longo", () => {
    const long = highlight({
      startSegmentId: "s0",
      startIndex: 0,
      startOffset: 11,
      endSegmentId: "s2",
      endIndex: 2,
      endOffset: 8,
    });

    expect(segmentMarkRanges(segments[0], [long])).toEqual([
      { start: 11, end: segments[0].text.length },
    ]);
  });

  it("marca o bloco do meio inteiro", () => {
    const long = highlight({
      startSegmentId: "s0",
      startIndex: 0,
      startOffset: 11,
      endSegmentId: "s2",
      endIndex: 2,
      endOffset: 8,
    });

    expect(segmentMarkRanges(segments[1], [long])).toEqual([
      { start: 0, end: segments[1].text.length },
    ]);
  });

  it("marca do começo até o deslocamento no último bloco", () => {
    const long = highlight({
      startSegmentId: "s0",
      startIndex: 0,
      startOffset: 11,
      endSegmentId: "s2",
      endIndex: 2,
      endOffset: 8,
    });

    expect(segmentMarkRanges(segments[2], [long])).toEqual([
      { start: 0, end: 8 },
    ]);
  });

  it("não marca bloco fora do destaque", () => {
    expect(segmentMarkRanges(segments[1], [highlight({})])).toEqual([]);
  });

  it("junta dois destaques que se sobrepõem no mesmo bloco", () => {
    const ranges = segmentMarkRanges(segments[0], [
      highlight({ id: "a", startOffset: 0, endOffset: 9 }),
      highlight({ id: "b", startOffset: 4, endOffset: 15 }),
    ]);

    expect(ranges).toEqual([{ start: 0, end: 15 }]);
  });

  it("corta deslocamento maior que o texto em vez de estourar", () => {
    const ranges = segmentMarkRanges(segments[2], [
      highlight({
        startSegmentId: "s2",
        startIndex: 2,
        startOffset: 0,
        endSegmentId: "s2",
        endIndex: 2,
        endOffset: 9999,
      }),
    ]);

    expect(ranges).toEqual([{ start: 0, end: segments[2].text.length }]);
  });
});
