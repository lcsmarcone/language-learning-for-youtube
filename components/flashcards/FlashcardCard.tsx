"use client";

import { useState } from "react";
import Link from "next/link";
import { Clipboard, ClipboardCheck, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { copyText, frontBackLine } from "@/lib/clipboard";
import { formatTimestamp } from "@/lib/time";
import { LANGUAGE_LABELS } from "@/lib/domain";
import type { FlashcardView } from "@/services/flashcards";

interface FlashcardCardProps {
  card: FlashcardView;
  selected: boolean;
  onToggleSelected: () => void;
  onDeleted: (id: string) => void;
  onUpdated: (card: FlashcardView) => void;
}

/**
 * Um flashcard na lista.
 *
 * O desenho é ditado pelo fluxo do Anki (instrucoes.md secao 7): os três botões
 * de copiar ficam sempre visíveis e na mesma ordem, porque a rotina é
 * "copiar original → colar na frente → copiar tradução → colar no verso", e
 * qualquer clique a mais nesse caminho é atrito multiplicado por dezenas de
 * cards.
 */
export function FlashcardCard({
  card,
  selected,
  onToggleSelected,
  onDeleted,
  onUpdated,
}: FlashcardCardProps) {
  const showToast = useToast((state) => state.show);

  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCopy(label: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
      showToast(`${label} copiado`);
    } else {
      showToast("Não foi possível copiar", "error");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/flashcards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        showToast(payload.error, "error");
        return;
      }
      onUpdated(payload.data);
      setEditing(false);
      showToast("Flashcard atualizado");
    } catch {
      showToast("Não foi possível salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Excluir este flashcard?")) return;

    try {
      const response = await fetch(`/api/flashcards/${card.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!payload.ok) {
        showToast(payload.error, "error");
        return;
      }
      onDeleted(card.id);
      showToast("Flashcard excluído");
    } catch {
      showToast("Não foi possível excluir", "error");
    }
  }

  return (
    <article
      className={
        selected
          ? "flex flex-col gap-3 rounded-lg border border-accent bg-accent-subtle/30 p-4 transition-colors"
          : "flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 transition-colors hover:border-border-strong"
      }
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          <Field label="Frente">
            <textarea
              value={front}
              onChange={(event) => setFront(event.target.value)}
              rows={2}
              className="w-full resize-y rounded-md border border-border bg-bg p-2 text-sm leading-relaxed text-fg"
            />
          </Field>
          <Field label="Verso">
            <textarea
              value={back}
              onChange={(event) => setBack(event.target.value)}
              rows={2}
              className="w-full resize-y rounded-md border border-border bg-bg p-2 text-sm leading-relaxed text-fg"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFront(card.front);
                setBack(card.back);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              disabled={saving || front.trim().length === 0}
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              aria-label={`Selecionar "${card.front}" para exportar`}
              className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
            />
            <div className="min-w-0 flex-1">
            <p className="font-serif text-[17px] leading-[1.5] text-fg">
              {card.front}
            </p>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-fg-muted">
              {card.back || (
                <span className="text-fg-subtle">Sem tradução.</span>
              )}
            </p>
            </div>
          </div>

          {card.contextText ? (
            <p className="line-clamp-2 border-l-2 border-border pl-3 text-xs leading-relaxed text-fg-subtle">
              {card.contextText}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
            <span>{LANGUAGE_LABELS[card.sourceLang as "en"] ?? card.sourceLang}</span>
            <span className="font-mono tabular-nums">
              {formatTimestamp(card.startMs)}
            </span>
            <span className="min-w-0 truncate" title={card.videoTitle}>
              {card.videoTitle}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 border-t border-border pt-3">
            <CopyButton
              label="Original"
              active={copied === "Original"}
              onClick={() => handleCopy("Original", card.front)}
            />
            <CopyButton
              label="Tradução"
              active={copied === "Tradução"}
              onClick={() => handleCopy("Tradução", card.back)}
            />
            <CopyButton
              label="Frente + verso"
              active={copied === "Frente + verso"}
              onClick={() =>
                handleCopy("Frente + verso", frontBackLine(card.front, card.back))
              }
            />

            <div className="ml-auto flex items-center gap-1">
              <Link
                href={`/video/${card.videoId}?t=${card.startMs}`}
                title="Ir para o vídeo neste ponto"
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
              >
                <ExternalLink size={12} strokeWidth={1.75} />
                Ir para o vídeo
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                title="Editar"
                aria-label="Editar"
              >
                <Pencil size={12} strokeWidth={1.75} />
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleDelete}
                title="Excluir"
                aria-label="Excluir"
              >
                <Trash2 size={12} strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function CopyButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button size="sm" onClick={onClick} title={`Copiar ${label.toLowerCase()}`}>
      {active ? (
        <ClipboardCheck size={12} strokeWidth={1.75} className="text-success" />
      ) : (
        <Clipboard size={12} strokeWidth={1.75} />
      )}
      {label}
    </Button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-fg-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
