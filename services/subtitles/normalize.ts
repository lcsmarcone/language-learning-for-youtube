import type { NormalizedSegment } from "@/lib/domain";

/**
 * Limpeza e normalização compartilhadas pelos parsers.
 *
 * Regra geral: preservar o texto que o usuário vai ler e selecionar, remover
 * só o que é marcação do formato. Um caractere removido a mais aqui quebra os
 * offsets de seleção lá na frente (instrucoes.md secao 6).
 */

/** Limite de segurança: legenda maior que isto quase certamente é abuso ou lixo. */
export const MAX_SEGMENTS = 20_000;

/** Duração mínima de um segmento, para o loop de repetição não virar um clique seco. */
export const MIN_SEGMENT_MS = 300;

/**
 * Prepara o texto bruto do arquivo: remove BOM, uniformiza quebras de linha e
 * tira espaços à direita de cada linha (comum em arquivos gerados por editores).
 */
export function normalizeRawText(input: string): string {
  return input
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n");
}

const TAG_PATTERNS: RegExp[] = [
  // Tags de tempo do WebVTT dentro do texto: <00:00:01.000>
  /<\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}>/g,
  // Tags HTML/VTT: <i>, </b>, <c.colorE5E5E5>, <font color="#fff">, <v Speaker>
  /<\/?[a-zA-Z][^>]*>/g,
  // Marcação de posicionamento do SubStation usada em alguns SRTs: {\an8}, {\i1}
  /\{\\[^}]*\}/g,
];

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&lrm;": "",
  "&rlm;": "",
};

/**
 * Remove marcação de formatação e resolve entidades.
 *
 * Cuidado deliberado: só remove `<...>` quando parece uma tag de verdade.
 * "5 < 10" continua intacto, porque `<` seguido de espaço não casa.
 */
export function stripMarkup(text: string): string {
  let result = text;
  for (const pattern of TAG_PATTERNS) {
    result = result.replace(pattern, "");
  }
  result = result.replace(
    /&(?:amp|lt|gt|quot|apos|#39|nbsp|lrm|rlm);/g,
    (match) => ENTITIES[match] ?? match,
  );
  return result;
}

/**
 * Junta as linhas de um bloco de legenda numa única frase.
 *
 * Legenda quebra linha por largura de tela, não por sentido; manter a quebra
 * atrapalha leitura, seleção e tradução. O hífen no fim da linha (palavra
 * partida) é reconstituído sem espaço.
 */
export function joinCueLines(lines: string[]): string {
  const cleaned = lines
    .map((line) => stripMarkup(line).trim())
    .filter((line) => line.length > 0);

  if (cleaned.length === 0) return "";

  return cleaned
    .reduce((acc, line) => {
      if (acc === "") return line;
      if (/[\p{L}\p{N}]-$/u.test(acc)) return acc.slice(0, -1) + line;
      return `${acc} ${line}`;
    }, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Converte "hh:mm:ss,mmm", "hh:mm:ss.mmm", "mm:ss.mmm" ou "mm:ss" em ms.
 *
 * Aceita vírgula e ponto em qualquer formato de propósito: arquivos reais
 * misturam os dois, e recusar por causa disso só irrita o usuário.
 * Retorna null quando o texto não é um timestamp.
 */
export function parseTimestamp(raw: string): number | null {
  const match = raw
    .trim()
    .match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;

  const [, hoursRaw, minutesRaw, secondsRaw, fractionRaw] = match;

  const hours = hoursRaw ? Number(hoursRaw) : 0;
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);
  if (minutes > 59 || seconds > 59) return null;

  // ".5" são 500 ms, ".05" são 50 ms — completar à direita, não à esquerda.
  const milliseconds = fractionRaw ? Number(fractionRaw.padEnd(3, "0")) : 0;

  return hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + milliseconds;
}

/** Bloco cru extraído por um parser, antes da normalização final. */
export interface RawCue {
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * Passo final comum a todos os parsers: ordena, descarta vazios, conserta
 * tempos inconsistentes e reindexa.
 *
 * Sobreposição é tratada encurtando o bloco anterior até o início do próximo.
 * É a escolha conservadora: o loop de repetição precisa de faixas que não se
 * invadem, e nenhum texto é perdido no processo.
 */
export function finalizeSegments(cues: RawCue[]): NormalizedSegment[] {
  const sorted = cues
    .filter((cue) => cue.text.trim().length > 0)
    .map((cue) => ({
      startMs: Math.max(0, Math.round(cue.startMs)),
      endMs: Math.max(0, Math.round(cue.endMs)),
      text: cue.text.trim(),
    }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const result: NormalizedSegment[] = [];

  for (const cue of sorted) {
    let endMs = cue.endMs;

    // Fim antes do início (ou igual) acontece em arquivos gerados por
    // ferramentas ruins. Damos uma duração mínima em vez de descartar a fala.
    if (endMs <= cue.startMs) {
      endMs = cue.startMs + MIN_SEGMENT_MS;
    }

    const previous = result[result.length - 1];
    if (previous && previous.endMs > cue.startMs) {
      previous.endMs = Math.max(previous.startMs + 1, cue.startMs);
    }

    result.push({ index: result.length, startMs: cue.startMs, endMs, text: cue.text });
  }

  return result;
}
