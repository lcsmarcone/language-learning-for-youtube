import type { NormalizedSegment, SubtitleSource } from "@/lib/domain";
import { err, ok, type Result } from "@/lib/result";
import { parsePlainTranscript } from "./parsePlainTranscript";
import { parseSrt } from "./parseSrt";
import { parseVtt } from "./parseVtt";
import { normalizeRawText } from "./normalize";

export { parsePlainTranscript } from "./parsePlainTranscript";
export { parseSrt } from "./parseSrt";
export { parseVtt } from "./parseVtt";
export * from "./normalize";

/** Resultado uniforme de qualquer caminho de importação de legenda. */
export interface ParsedSubtitle {
  segments: NormalizedSegment[];
  source: SubtitleSource;
  timingsApproximate: boolean;
}

export interface ParseSubtitleOptions {
  /** Nome do arquivo, quando houver — usado só como pista de formato. */
  filename?: string | null;
  /** Duração do vídeo em segundos, quando conhecida. */
  durationSec?: number | null;
}

/**
 * Ponto de entrada único da importação de legendas.
 *
 * Detecta o formato pelo conteúdo, não pela extensão: arquivo `.txt` com
 * conteúdo VTT é comum, e `.srt` com ponto no lugar da vírgula também. A
 * extensão só desempata.
 */
export function parseSubtitle(
  input: string,
  options: ParseSubtitleOptions = {},
): Result<ParsedSubtitle> {
  const text = normalizeRawText(input);

  if (text.trim().length === 0) {
    return err("O conteúdo da legenda está vazio.");
  }

  const format = detectFormat(text, options.filename);

  if (format === "vtt") {
    const parsed = parseVtt(text);
    if (!parsed.ok) return parsed;
    return ok({
      segments: parsed.value,
      source: "vtt",
      timingsApproximate: false,
    });
  }

  if (format === "srt") {
    const parsed = parseSrt(text);
    if (!parsed.ok) return parsed;
    return ok({
      segments: parsed.value,
      source: "srt",
      timingsApproximate: false,
    });
  }

  const parsed = parsePlainTranscript(text, {
    durationSec: options.durationSec,
  });
  if (!parsed.ok) return parsed;

  return ok({
    segments: parsed.value.segments,
    source: "transcript",
    timingsApproximate: parsed.value.timingsApproximate,
  });
}

/** Formato provável do conteúdo. "transcript" é o fallback. */
export function detectFormat(
  text: string,
  filename?: string | null,
): SubtitleSource {
  if (/^\s*WEBVTT/.test(text)) return "vtt";

  const hasArrow = /-->/.test(text);
  if (hasArrow) {
    // A vírgula nos milissegundos é a marca registrada do SRT; o ponto, do VTT.
    const commaCues = (text.match(/\d{2},\d{3}\s*-->/g) ?? []).length;
    const dotCues = (text.match(/\d{2}\.\d{3}\s*-->/g) ?? []).length;

    if (commaCues > dotCues) return "srt";
    if (dotCues > commaCues) return "vtt";

    const extension = filename?.toLowerCase().split(".").pop();
    if (extension === "vtt") return "vtt";
    return "srt";
  }

  return "transcript";
}
