import type { NormalizedSegment } from "@/lib/domain";
import type { LoopMode } from "@/lib/playerStore";

type TimedSegment = Pick<NormalizedSegment, "startMs" | "endMs">;

/**
 * Tolerância para trás.
 *
 * Se o tempo cai antes do início do trecho em loop, quem mandou foi o usuário
 * (arrastou a barra do YouTube), e a gente devolve ao início do trecho. A
 * folga existe porque o `seekTo` do YouTube não pousa exatamente no ponto
 * pedido — ele vai para o quadro-chave mais próximo, o que pode ficar algumas
 * centenas de milissegundos antes. Sem essa folga, o loop dispararia um novo
 * seek logo depois de cada seek, e o vídeo travaria no lugar.
 */
const BEHIND_TOLERANCE_MS = 1000;

/**
 * Decide se o loop precisa voltar o vídeo, e para onde.
 *
 * Função pura de propósito: é a regra mais fácil de errar do produto e a mais
 * difícil de observar rodando (depende de vídeo tocando de verdade), então
 * fica isolada aqui, onde o teste alcança.
 *
 * Devolve o instante para onde saltar, ou `null` quando não há nada a fazer.
 */
export function resolveLoopSeek(
  loop: LoopMode,
  currentMs: number,
  segments: readonly TimedSegment[],
): number | null {
  if (loop.kind === "none") return null;

  const bounds =
    loop.kind === "segment"
      ? segments[loop.index]
      : { startMs: loop.startMs, endMs: loop.endMs };

  if (!bounds) return null;
  if (bounds.endMs <= bounds.startMs) return null;

  // Chegou ao fim do trecho: recomeça.
  if (currentMs >= bounds.endMs) return bounds.startMs;

  // Ficou bem antes do início: o usuário saiu do trecho, traz de volta.
  if (currentMs < bounds.startMs - BEHIND_TOLERANCE_MS) return bounds.startMs;

  return null;
}
