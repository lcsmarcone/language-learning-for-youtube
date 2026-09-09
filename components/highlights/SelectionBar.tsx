"use client";

import { useState } from "react";
import { Highlighter, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSelectionStore } from "@/lib/selectionStore";
import type { StudySegment } from "@/lib/domain";

interface SelectionBarProps {
  videoId: string;
  segments: StudySegment[];
}

/**
 * Barra inferior da tela de estudo (instrucoes.md secao 12).
 *
 * Aparece só quando há seleção, e mostra os dois lados: o trecho exato que o
 * usuário marcou e a frase correspondente do outro idioma. É o lugar onde a
 * seleção vira algo — hoje um destaque salvo, e na próxima etapa um flashcard.
 */
export function SelectionBar({ videoId, segments }: SelectionBarProps) {
  const selection = useSelectionStore((state) => state.current);
  const clear = useSelectionStore((state) => state.clear);
  const addHighlight = useSelectionStore((state) => state.addHighlight);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selection) return null;

  // O outro lado é sempre o segmento inteiro correspondente — nunca um recorte
  // proporcional, que seria correspondência inventada.
  const touched = segments.filter(
    (segment) =>
      segment.index >= selection.startIndex && segment.index <= selection.endIndex,
  );

  const counterpart =
    selection.side === "original"
      ? touched
          .map((segment) => segment.translatedText)
          .filter((text): text is string => Boolean(text))
          .join(" ")
      : touched.map((segment) => segment.text).join(" ");

  async function handleSave() {
    if (!selection) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/videos/${videoId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startSegmentId: selection.startSegmentId,
          startOffset: selection.startOffset,
          endSegmentId: selection.endSegmentId,
          endOffset: selection.endOffset,
          quotedText: selection.quotedText,
          translatedText: counterpart || null,
        }),
      });

      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error);
        return;
      }

      addHighlight(payload.data);
      window.getSelection()?.removeAllRanges();
      clear();
    } catch {
      setError("Não foi possível salvar a marcação agora.");
    } finally {
      setSaving(false);
    }
  }

  const originalText =
    selection.side === "original" ? selection.quotedText : counterpart;
  const translatedText =
    selection.side === "original" ? counterpart : selection.quotedText;

  return (
    <div className="shrink-0 border-t border-border bg-bg-elevated px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-fg" title={originalText}>
            {originalText}
          </p>
          <p
            className="truncate text-sm text-fg-muted"
            title={translatedText || undefined}
          >
            {translatedText || "Sem tradução para este trecho ainda."}
          </p>
          {error ? (
            <p role="alert" className="mt-1 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            <Highlighter size={13} strokeWidth={1.75} />
            {saving ? "Marcando…" : "Marcar trecho"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.getSelection()?.removeAllRanges();
              clear();
            }}
            title="Cancelar seleção (Esc)"
          >
            <X size={13} strokeWidth={1.75} />
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
