"use client";

import { Download } from "lucide-react";

interface ExportBarProps {
  /** Ids selecionados; vazio significa "tudo que está filtrado". */
  selectedIds: string[];
  /** Ids atualmente visíveis depois de filtro e busca. */
  visibleIds: string[];
  videoId: string | null;
}

/**
 * Exportação em lote (instrucoes.md secao 8).
 *
 * Os botões são links diretos para a rota de download. Sem `fetch`, sem `Blob`
 * montado na memória do navegador: o arquivo vem do servidor como anexo, que é
 * o caminho mais simples e o que menos tem para dar errado.
 */
export function ExportBar({ selectedIds, visibleIds, videoId }: ExportBarProps) {
  const exporting = selectedIds.length > 0 ? selectedIds : visibleIds;
  if (exporting.length === 0) return null;

  const params = new URLSearchParams();
  if (videoId && selectedIds.length === 0) {
    params.set("videoId", videoId);
  } else {
    params.set("ids", exporting.join(","));
  }

  const label =
    selectedIds.length > 0
      ? `${selectedIds.length} ${selectedIds.length === 1 ? "selecionado" : "selecionados"}`
      : `${visibleIds.length} ${visibleIds.length === 1 ? "flashcard" : "flashcards"}`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2">
      <Download size={13} strokeWidth={1.75} className="text-fg-muted" />
      <span className="text-xs text-fg-muted">Exportar {label}</span>

      <div className="ml-auto flex items-center gap-1.5">
        <ExportLink params={params} format="tsv" label="TSV" hint="Formato mais direto para importar no Anki" />
        <ExportLink params={params} format="csv" label="CSV" hint="Para abrir em planilha" />
      </div>
    </div>
  );
}

function ExportLink({
  params,
  format,
  label,
  hint,
}: {
  params: URLSearchParams;
  format: string;
  label: string;
  hint: string;
}) {
  const query = new URLSearchParams(params);
  query.set("format", format);

  return (
    <a
      href={`/api/flashcards/export?${query.toString()}`}
      title={hint}
      // `download` deixa explícito que é para baixar, não navegar.
      download
      className="inline-flex h-7 items-center rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-fg transition-colors hover:bg-bg-hover"
    >
      {label}
    </a>
  );
}
