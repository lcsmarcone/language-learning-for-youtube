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
 * Parser de WebVTT.
 *
 * Além dos cues, o formato tem blocos NOTE, STYLE e REGION que precisam ser
 * pulados inteiros, identificadores opcionais antes da linha de tempo e
 * configurações de posicionamento depois dela (align:start position:10%).
 * Tudo isso é descartado: só interessam tempo e texto.
 */

const TIME_LINE =
  /^\s*(\d{1,3}:\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?|\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,3}:\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?|\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)/;

/** Blocos que ocupam várias linhas e não contêm fala. */
const SKIPPABLE_BLOCK = /^(NOTE|STYLE|REGION)\b/;

export function parseVtt(input: string): Result<NormalizedSegment[]> {
  const text = normalizeRawText(input);

  if (text.trim().length === 0) {
    return err("O arquivo de legenda está vazio.");
  }

  const lines = text.split("\n");
  const cues: RawCue[] = [];

  let cursor = 0;

  // O cabeçalho WEBVTT é obrigatório no formato, mas arquivos gerados por
  // ferramentas às vezes o perdem. Aceitamos a ausência: se houver linhas de
  // tempo válidas, o conteúdo é aproveitável.
  if (/^\s*WEBVTT/.test(lines[0] ?? "")) {
    cursor = 1;
  }

  while (cursor < lines.length) {
    const line = lines[cursor];

    if (line.trim() === "") {
      cursor += 1;
      continue;
    }

    if (SKIPPABLE_BLOCK.test(line.trim())) {
      // Bloco vai até a próxima linha em branco.
      cursor += 1;
      while (cursor < lines.length && lines[cursor].trim() !== "") cursor += 1;
      continue;
    }

    // Identificador do cue: linha qualquer imediatamente antes da de tempo.
    if (!TIME_LINE.test(line)) {
      if (cursor + 1 < lines.length && TIME_LINE.test(lines[cursor + 1])) {
        cursor += 1;
        continue;
      }
      cursor += 1;
      continue;
    }

    const timeMatch = line.match(TIME_LINE);
    const startMs = timeMatch ? parseTimestamp(timeMatch[1]) : null;
    const endMs = timeMatch ? parseTimestamp(timeMatch[2]) : null;
    cursor += 1;

    const bodyLines: string[] = [];
    while (cursor < lines.length) {
      const bodyLine = lines[cursor];
      if (bodyLine.trim() === "") break;
      if (TIME_LINE.test(bodyLine)) break;
      if (
        cursor + 1 < lines.length &&
        TIME_LINE.test(lines[cursor + 1]) &&
        bodyLine.trim() !== ""
      ) {
        // Linha seguinte é tempo: esta é o identificador do próximo cue.
        break;
      }
      bodyLines.push(bodyLine);
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
      "Nenhum bloco de legenda foi reconhecido. O arquivo parece não estar no formato VTT.",
    );
  }

  return ok(finalizeSegments(dedupeRolling(cues)));
}

/**
 * Legendas automáticas do YouTube repetem a mesma frase em cues sucessivos
 * (efeito de "rolagem": cada cue mostra o fim da fala anterior mais a nova).
 * Quando um cue apenas repete o texto do anterior, ele é descartado; quando o
 * estende, mantemos só a parte nova.
 *
 * Sem isso, a transcrição fica com cada frase duplicada duas ou três vezes.
 */
function dedupeRolling(cues: RawCue[]): RawCue[] {
  const result: RawCue[] = [];

  for (const cue of cues) {
    const previous = result[result.length - 1];

    if (!previous) {
      result.push(cue);
      continue;
    }

    if (cue.text === previous.text) {
      // Mesma fala repetida: estende o bloco anterior em vez de duplicar.
      previous.endMs = Math.max(previous.endMs, cue.endMs);
      continue;
    }

    if (cue.text.startsWith(previous.text)) {
      const remainder = cue.text.slice(previous.text.length).trim();
      if (remainder.length === 0) {
        previous.endMs = Math.max(previous.endMs, cue.endMs);
        continue;
      }
      result.push({ startMs: cue.startMs, endMs: cue.endMs, text: remainder });
      continue;
    }

    result.push(cue);
  }

  return result;
}
