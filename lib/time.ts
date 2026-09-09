/**
 * Formatação de tempo. Vive isolada porque timestamp aparece em muitos lugares
 * (bloco de legenda, flashcard, exportação) e precisa ser idêntico em todos.
 */

/**
 * Milissegundos para "mm:ss", ou "h:mm:ss" quando passa de uma hora.
 * Exemplo: 134000 -> "02:14".
 */
export function formatTimestamp(ms: number): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Duração legível para a biblioteca: "32 min", "1 h 12 min", "48 s".
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";

  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 1) return `${Math.round(seconds)} s`;
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** Segundos (float, como o player entrega) para milissegundos inteiros. */
export function secondsToMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

/** Milissegundos para segundos com casas decimais (o que o player aceita). */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}
