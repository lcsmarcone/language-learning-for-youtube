import { describe, expect, it } from "vitest";
import {
  findActiveSegmentIndex,
  findNearestSegmentIndex,
  resolveHighlightedIndex,
} from "@/lib/sync";

const segments = [
  { startMs: 0, endMs: 2000 },
  { startMs: 2000, endMs: 4000 },
  // Silêncio entre 4s e 6s.
  { startMs: 6000, endMs: 8000 },
];

describe("findActiveSegmentIndex", () => {
  it("encontra o segmento que contém o instante", () => {
    expect(findActiveSegmentIndex(segments, 0)).toBe(0);
    expect(findActiveSegmentIndex(segments, 1999)).toBe(0);
    expect(findActiveSegmentIndex(segments, 2000)).toBe(1);
    expect(findActiveSegmentIndex(segments, 7999)).toBe(2);
  });

  it("devolve -1 no silêncio, antes do início e depois do fim", () => {
    expect(findActiveSegmentIndex(segments, 5000)).toBe(-1);
    expect(findActiveSegmentIndex(segments, 9000)).toBe(-1);
    expect(findActiveSegmentIndex([], 100)).toBe(-1);
  });

  it("dá o mesmo resultado que uma varredura linear, em lista grande", () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      startMs: i * 1000,
      endMs: i * 1000 + 900,
    }));

    for (const ms of [0, 950, 1000, 2_500_000, 4_999_899, 4_999_900]) {
      const linear = many.findIndex((s) => ms >= s.startMs && ms < s.endMs);
      expect(findActiveSegmentIndex(many, ms)).toBe(linear);
    }
  });
});

describe("findNearestSegmentIndex", () => {
  it("devolve o último segmento já iniciado", () => {
    expect(findNearestSegmentIndex(segments, 5000)).toBe(1);
    expect(findNearestSegmentIndex(segments, 9000)).toBe(2);
  });

  it("devolve -1 antes do primeiro segmento", () => {
    const later = [{ startMs: 1000, endMs: 2000 }];
    expect(findNearestSegmentIndex(later, 500)).toBe(-1);
  });
});

describe("resolveHighlightedIndex", () => {
  it("mantém o destaque durante o silêncio", () => {
    expect(resolveHighlightedIndex(segments, 5000, 1)).toBe(1);
  });

  it("solta o destaque ao voltar no tempo", () => {
    expect(resolveHighlightedIndex(segments, 500, 2)).toBe(0);
  });

  it("acompanha a reprodução normalmente", () => {
    expect(resolveHighlightedIndex(segments, 2500, 0)).toBe(1);
  });
});
