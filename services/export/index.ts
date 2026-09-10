import { CsvExporter, TsvExporter } from "./formats";
import type { FlashcardExporter } from "./types";

export * from "./types";
export { CsvExporter, TsvExporter, escapeCsv } from "./formats";

/**
 * Registro de formatos de exportação.
 *
 * Adicionar AnkiConnect ou `.apkg` no futuro é escrever a classe e incluir
 * aqui — nenhum outro arquivo muda.
 */
const EXPORTERS: FlashcardExporter[] = [new TsvExporter(), new CsvExporter()];

export function listExporters(): FlashcardExporter[] {
  return EXPORTERS;
}

export function getExporter(id: string): FlashcardExporter | null {
  return EXPORTERS.find((exporter) => exporter.id === id) ?? null;
}
