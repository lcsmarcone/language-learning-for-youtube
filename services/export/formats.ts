import { formatTimestamp } from "@/lib/time";
import { sanitizeField } from "@/lib/clipboard";
import type { FlashcardView } from "@/services/flashcards";
import {
  EXPORT_COLUMNS,
  type ExportOptions,
  type ExportedFile,
  type FlashcardExporter,
} from "./types";

/**
 * TSV e CSV.
 *
 * São formatos diferentes com um problema em comum: um caractere separador que
 * escapa para dentro de um campo desloca todas as colunas seguintes, e o Anki
 * importa o arquivo inteiro errado sem reclamar. Cada formato resolve isso de
 * um jeito, e é por isso que eles não compartilham a função de escape:
 *
 * - **TSV** não tem escape de verdade. A saída só é confiável se tabulação e
 *   quebra de linha simplesmente não existirem nos campos, então elas viram
 *   espaço. É o formato que o Anki cola melhor.
 * - **CSV** tem escape: aspas dobradas dentro de aspas. Aí a quebra de linha
 *   pode ser preservada, e é o formato para abrir em planilha.
 */

function rowFor(card: FlashcardView): string[] {
  return [
    card.front,
    card.back,
    card.videoTitle,
    formatTimestamp(card.startMs),
  ];
}

function baseFilename(options: ExportOptions, extension: string): string {
  const raw = options.baseName?.trim() || "flashcards";
  // Nome de arquivo seguro em qualquer sistema, sem depender de sorte.
  const safe = raw
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");

  return `${safe || "flashcards"}.${extension}`;
}

export class TsvExporter implements FlashcardExporter {
  readonly id = "tsv";
  readonly label = "TSV (recomendado para o Anki)";
  readonly extension = "tsv";

  export(cards: FlashcardView[], options: ExportOptions = {}): ExportedFile {
    const lines: string[] = [];

    if (options.includeHeader) {
      lines.push(EXPORT_COLUMNS.join("\t"));
    }

    for (const card of cards) {
      lines.push(rowFor(card).map(sanitizeField).join("\t"));
    }

    return {
      filename: baseFilename(options, this.extension),
      contentType: "text/tab-separated-values; charset=utf-8",
      content: lines.join("\n"),
    };
  }
}

export class CsvExporter implements FlashcardExporter {
  readonly id = "csv";
  readonly label = "CSV (para planilha)";
  readonly extension = "csv";

  export(cards: FlashcardView[], options: ExportOptions = {}): ExportedFile {
    const lines: string[] = [];

    if (options.includeHeader) {
      lines.push(EXPORT_COLUMNS.map(escapeCsv).join(","));
    }

    for (const card of cards) {
      lines.push(rowFor(card).map(escapeCsv).join(","));
    }

    return {
      filename: baseFilename(options, this.extension),
      // CRLF é o que a especificação do CSV pede e o que o Excel espera.
      content: lines.join("\r\n"),
      contentType: "text/csv; charset=utf-8",
    };
  }
}

/**
 * Envolve em aspas quando o campo contém separador, aspas ou quebra de linha,
 * dobrando as aspas internas.
 */
export function escapeCsv(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
