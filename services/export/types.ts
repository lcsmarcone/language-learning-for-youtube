import type { FlashcardView } from "@/services/flashcards";

/**
 * Exportação de flashcards (instrucoes.md secao 8).
 *
 * A interface existe para o que vem depois: AnkiConnect (enviar direto para o
 * Anki aberto), geração de pacote `.apkg`, outros sistemas de repetição
 * espaçada. Nenhum deles é implementado agora — seriam a parte mais frágil da
 * primeira versão —, mas nenhum deles exige refatorar isto aqui: é escrever
 * uma classe nova e registrá-la.
 */

export interface ExportedFile {
  filename: string;
  /** Tipo MIME, já com charset — o Anki lê UTF-8. */
  contentType: string;
  content: string;
}

export interface FlashcardExporter {
  /** Identificador usado na URL (`?format=tsv`). */
  readonly id: string;
  /** Nome exibível na interface. */
  readonly label: string;
  readonly extension: string;

  export(cards: FlashcardView[], options: ExportOptions): ExportedFile;
}

export interface ExportOptions {
  /** Nome base do arquivo, normalmente o título do vídeo. */
  baseName?: string;
  /** Inclui a linha de cabeçalho com os nomes das colunas. */
  includeHeader?: boolean;
}

/** Colunas do arquivo, na ordem sugerida pelas instruções. */
export const EXPORT_COLUMNS = ["Front", "Back", "Source", "Timestamp"] as const;
