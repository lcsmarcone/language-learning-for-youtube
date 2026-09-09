import type { NormalizedSegment } from "@/lib/domain";
import { err, ok, type Result } from "@/lib/result";
import {
  finalizeSegments,
  joinCueLines,
  MAX_SEGMENTS,
  normalizeRawText,
  parseTimestamp,
  type RawCue,
} from "./normalize";

/**
 * Parser de SRT.
 *
 * Tolerante de propósito. Arquivos reais vêm com numeração faltando, linhas em
 * branco a mais, tempos com ponto em vez de vírgula e blocos sem texto. Nada
 * disso justifica recusar o arquivo inteiro: blocos individuais quebrados são
 * ignorados, e só falha de verdade quando não há nenhum bloco válido.
 */

const TIME_LINE =
  /^\s*(\d{1,3}:\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?|\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,3}:\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?|\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)/;

export function parseSrt(input: string): Result<NormalizedSegment[]> {
  const text = normalizeRawText(input);

  if (text.trim().length === 0) {
    return err("O arquivo de legenda está vazio.");
  }

  const lines = text.split("\n");
  const cues: RawCue[] = [];

  let cursor = 0;
  while (cursor < lines.length) {
    const timeMatch = lines[cursor].match(TIME_LINE);
    if (!timeMatch) {
      // Numeração, cabeçalho ou linha solta: avança até achar uma linha de tempo.
      cursor += 1;
      continue;
    }

    const startMs = parseTimestamp(timeMatch[1]);
    const endMs = parseTimestamp(timeMatch[2]);
    cursor += 1;

    const bodyLines: string[] = [];
    while (cursor < lines.length) {
      const line = lines[cursor];
      // Um bloco termina em linha vazia ou quando começa o bloco seguinte.
      if (line.trim() === "") break;
      if (TIME_LINE.test(line)) break;
      // Numeração do próximo bloco imediatamente antes da linha de tempo.
      if (
        /^\s*\d+\s*$/.test(line) &&
        cursor + 1 < lines.length &&
        TIME_LINE.test(lines[cursor + 1])
      ) {
        break;
      }
      bodyLines.push(line);
      cursor += 1;
    }

    if (startMs === null || endMs === null) continue;

    const body = joinCueLines(bodyLines);
    if (body.length === 0) continue;

    cues.push({ startMs, endMs, text: body });

    if (cues.length > MAX_SEGMENTS) {
      return err(
        `A legenda tem mais de ${MAX_SEGMENTS.toLocaleString("pt-BR")} blocos. Verifique se o arquivo está correto.`,
      );
    }
  }

  if (cues.length === 0) {
    return err(
      "Nenhum bloco de legenda foi reconhecido. O arquivo parece não estar no formato SRT.",
    );
  }

  return ok(finalizeSegments(cues));
}
