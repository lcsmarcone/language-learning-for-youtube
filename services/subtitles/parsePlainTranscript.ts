import type { NormalizedSegment } from "@/lib/domain";
import { err, ok, type Result } from "@/lib/result";
import {
  finalizeSegments,
  MAX_SEGMENTS,
  MIN_SEGMENT_MS,
  normalizeRawText,
  parseTimestamp,
  stripMarkup,
  type RawCue,
} from "./normalize";

/**
 * Transcrição colada pelo usuário — o caminho de escape quando não existe SRT
 * nem VTT (instrucoes.md secao 4).
 *
 * Dois casos bem diferentes são tratados aqui:
 *
 * 1. **Transcrição com marcas de tempo** — é o que sai do botão "Mostrar
 *    transcrição" do YouTube. Os tempos são reais, então a sincronia funciona
 *    de verdade e o resultado NÃO é aproximado.
 * 2. **Texto corrido, sem tempo nenhum** — os tempos são estimados a partir do
 *    tamanho do texto. Funciona para ler e criar flashcards, mas a sincronia é
 *    aproximada e a UI precisa dizer isso ao usuário.
 */

export interface ParsedTranscript {
  segments: NormalizedSegment[];
  /** true quando os tempos foram inventados por estimativa. */
  timingsApproximate: boolean;
}

export interface ParseTranscriptOptions {
  /** Duração do vídeo, quando conhecida. Melhora muito a estimativa. */
  durationSec?: number | null;
}

/** Velocidade de fala típica, em caracteres por segundo. */
const CHARS_PER_SECOND = 14;

/** Tamanho acima do qual um bloco vira difícil de acompanhar e de repetir. */
const MAX_SEGMENT_CHARS = 220;

/** Linha que contém apenas um tempo: "0:15", "01:02:03". */
const TIMESTAMP_ONLY = /^\s*(\d{1,3}:\d{1,2}(?::\d{1,2})?(?:[.,]\d{1,3})?)\s*$/;

/** Tempo no começo da linha, seguido do texto: "0:15 All right, so here we are". */
const TIMESTAMP_PREFIX =
  /^\s*(\d{1,3}:\d{1,2}(?::\d{1,2})?(?:[.,]\d{1,3})?)\s+(\S.*)$/;

export function parsePlainTranscript(
  input: string,
  options: ParseTranscriptOptions = {},
): Result<ParsedTranscript> {
  const text = normalizeRawText(input);

  if (text.trim().length === 0) {
    return err("Cole o texto da transcrição para continuar.");
  }

  const lines = text.split("\n");

  const { entries: timed, consumedLines } = extractTimedLines(lines);
  const nonEmptyLines = lines.filter((line) => line.trim() !== "").length;

  // Quando tratar como transcrição com tempo:
  //
  // - duas ou mais marcas de tempo já são padrão suficiente; ou
  // - uma única marca, desde que TODAS as linhas do texto estejam sob ela.
  //
  // A segunda condição existe para não confundir prosa com legenda: em
  // "Cheguei às 3:15 e ele já tinha ido", a linha do tempo seria uma no meio de
  // várias soltas, e aí o texto é tratado como prosa mesmo.
  const looksTimed =
    timed.length >= 2 || (timed.length === 1 && consumedLines === nonEmptyLines);

  if (looksTimed) {
    return ok({
      segments: finalizeSegments(closeOpenEnds(timed, options.durationSec)),
      timingsApproximate: false,
    });
  }

  const pieces = splitIntoPieces(lines);
  if (pieces.length === 0) {
    return err("Não encontramos nenhum texto utilizável na transcrição.");
  }
  if (pieces.length > MAX_SEGMENTS) {
    return err(
      `A transcrição gerou mais de ${MAX_SEGMENTS.toLocaleString("pt-BR")} blocos. Verifique se o texto está correto.`,
    );
  }

  return ok({
    segments: finalizeSegments(estimateTimings(pieces, options.durationSec)),
    timingsApproximate: true,
  });
}

/**
 * Extrai pares (tempo, texto) das duas formas aceitas de transcrição com tempo.
 *
 * Devolve também quantas linhas não vazias foram consumidas: é isso que
 * permite distinguir uma transcrição curta de um texto em prosa que por acaso
 * menciona um horário.
 */
function extractTimedLines(lines: string[]): {
  entries: Array<{ startMs: number; text: string }>;
  consumedLines: number;
} {
  const entries: Array<{ startMs: number; text: string }> = [];
  let consumedLines = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const inline = line.match(TIMESTAMP_PREFIX);
    if (inline) {
      const startMs = parseTimestamp(inline[1]);
      const body = stripMarkup(inline[2]).trim();
      if (startMs !== null && body.length > 0) {
        entries.push({ startMs, text: body });
        consumedLines += 1;
      }
      continue;
    }

    const alone = line.match(TIMESTAMP_ONLY);
    if (alone) {
      const startMs = parseTimestamp(alone[1]);
      if (startMs === null) continue;

      // O texto vem nas linhas seguintes, até o próximo tempo.
      const body: string[] = [];
      let cursor = i + 1;
      while (cursor < lines.length) {
        const next = lines[cursor];
        if (TIMESTAMP_ONLY.test(next) || TIMESTAMP_PREFIX.test(next)) break;
        if (next.trim() !== "") body.push(stripMarkup(next).trim());
        cursor += 1;
      }

      const joined = body.join(" ").replace(/\s{2,}/g, " ").trim();
      if (joined.length > 0) {
        entries.push({ startMs, text: joined });
        // A linha do tempo mais as linhas de texto que ela cobre.
        consumedLines += 1 + body.length;
      }
      i = cursor - 1;
    }
  }

  return { entries, consumedLines };
}

/**
 * Cada bloco termina quando o próximo começa. O último recebe uma duração
 * estimada, limitada pela duração do vídeo quando ela é conhecida.
 */
function closeOpenEnds(
  timed: Array<{ startMs: number; text: string }>,
  durationSec?: number | null,
): RawCue[] {
  const sorted = [...timed].sort((a, b) => a.startMs - b.startMs);

  return sorted.map((entry, index) => {
    const next = sorted[index + 1];
    if (next) {
      return { startMs: entry.startMs, endMs: next.startMs, text: entry.text };
    }

    const estimated = Math.max(
      MIN_SEGMENT_MS,
      Math.round((entry.text.length / CHARS_PER_SECOND) * 1000),
    );
    const endMs =
      durationSec && durationSec > 0
        ? Math.max(entry.startMs + MIN_SEGMENT_MS, durationSec * 1000)
        : entry.startMs + estimated;

    return { startMs: entry.startMs, endMs, text: entry.text };
  });
}

/**
 * Quebra o texto em blocos legíveis.
 *
 * Se o usuário colou várias linhas, cada linha já é uma unidade e respeitamos
 * isso. Se colou um parágrafo único, quebramos por frase. Blocos ainda longos
 * demais são divididos em vírgulas, e só então à força — sempre em espaço,
 * nunca no meio de uma palavra.
 */
function splitIntoPieces(lines: string[]): string[] {
  const nonEmpty = lines
    .map((line) => stripMarkup(line).replace(/\s{2,}/g, " ").trim())
    .filter((line) => line.length > 0);

  if (nonEmpty.length === 0) return [];

  const base =
    nonEmpty.length > 1 ? nonEmpty : splitIntoSentences(nonEmpty[0]);

  return base.flatMap((piece) =>
    piece.length <= MAX_SEGMENT_CHARS ? [piece] : splitLongPiece(piece),
  );
}

function splitIntoSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?…])["'”’)\]]*\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function splitLongPiece(piece: string): string[] {
  const bySentence = splitIntoSentences(piece);
  const candidates = bySentence.length > 1 ? bySentence : [piece];

  return candidates.flatMap((candidate) => {
    if (candidate.length <= MAX_SEGMENT_CHARS) return [candidate];

    const chunks: string[] = [];
    let current = "";

    for (const word of candidate.split(/\s+/)) {
      const next = current === "" ? word : `${current} ${word}`;
      if (next.length > MAX_SEGMENT_CHARS && current !== "") {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current !== "") chunks.push(current);

    return chunks;
  });
}

/**
 * Distribui os tempos proporcionalmente ao tamanho de cada bloco.
 *
 * Com a duração do vídeo conhecida, o texto é esticado para cobrir o vídeo
 * inteiro; sem ela, usa-se uma velocidade de fala típica. Nos dois casos é
 * estimativa, e o chamador marca a faixa como aproximada.
 */
function estimateTimings(
  pieces: string[],
  durationSec?: number | null,
): RawCue[] {
  const totalChars = pieces.reduce((sum, piece) => sum + piece.length, 0);
  const totalMs =
    durationSec && durationSec > 0
      ? durationSec * 1000
      : Math.round((totalChars / CHARS_PER_SECOND) * 1000);

  const cues: RawCue[] = [];
  let cursorMs = 0;

  for (const piece of pieces) {
    const share = totalChars > 0 ? piece.length / totalChars : 1 / pieces.length;
    const durationMs = Math.max(MIN_SEGMENT_MS, Math.round(totalMs * share));

    cues.push({
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
      text: piece,
    });
    cursorMs += durationMs;
  }

  return cues;
}
