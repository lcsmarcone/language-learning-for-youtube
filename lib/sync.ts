import type { NormalizedSegment } from "@/lib/domain";

/**
 * Sincronização tempo → segmento.
 *
 * Roda várias vezes por segundo enquanto o vídeo toca, sobre listas que podem
 * ter milhares de blocos (instrucoes.md secao 19). Por isso é busca binária, e
 * por isso é uma função pura, testável e fora de qualquer componente React.
 *
 * Pré-condição: `segments` ordenados por `startMs` — que é o que
 * `finalizeSegments` garante.
 */

type TimedSegment = Pick<NormalizedSegment, "startMs" | "endMs">;

/**
 * Índice do segmento que contém o instante `ms`, ou -1 quando o instante cai
 * num intervalo de silêncio entre blocos.
 *
 * O -1 é informação útil, não um erro: a UI decide se apaga o destaque ou
 * mantém o último segmento marcado (mantemos, para a linha não piscar).
 */
export function findActiveSegmentIndex(
  segments: readonly TimedSegment[],
  ms: number,
): number {
  let low = 0;
  let high = segments.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = segments[mid];

    if (ms < segment.startMs) {
      high = mid - 1;
    } else if (ms >= segment.endMs) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  return -1;
}

/**
 * Índice do último segmento que já começou em `ms`. Nunca devolve -1 depois do
 * início da legenda — é o que a navegação "frase anterior/próxima" e o
 * auto-scroll usam, porque eles precisam sempre de uma referência.
 *
 * Antes do primeiro segmento, devolve -1.
 */
export function findNearestSegmentIndex(
  segments: readonly TimedSegment[],
  ms: number,
): number {
  if (segments.length === 0) return -1;
  if (ms < segments[0].startMs) return -1;

  let low = 0;
  let high = segments.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (segments[mid].startMs <= ms) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * Mantém o destaque estável durante os silêncios: se o instante não está em
 * nenhum bloco, conserva o anterior em vez de apagar o destaque.
 */
export function resolveHighlightedIndex(
  segments: readonly TimedSegment[],
  ms: number,
  previousIndex: number,
): number {
  const active = findActiveSegmentIndex(segments, ms);
  if (active !== -1) return active;

  // Voltar no tempo (seek para trás) deve soltar o destaque antigo.
  const previous = segments[previousIndex];
  if (previous && ms < previous.startMs) {
    return findNearestSegmentIndex(segments, ms);
  }

  return previousIndex;
}
