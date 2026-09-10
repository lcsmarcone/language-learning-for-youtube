"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { LibraryVideo } from "@/services/library";
import { LANGUAGE_LABELS } from "@/lib/domain";
import { formatDuration } from "@/lib/time";

/**
 * Card da biblioteca (instrucoes.md secao 9).
 *
 * Mostra só o que ajuda a decidir o que estudar agora: capa, título, idioma,
 * duração, progresso e quantos flashcards já saíram dali.
 */
export function VideoCard({ video }: { video: LibraryVideo }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percent = Math.round(video.percentComplete * 100);
  const translated =
    video.segmentCount > 0
      ? Math.round((video.translatedCount / video.segmentCount) * 100)
      : 0;

  async function handleDelete() {
    // Exclusão apaga legendas e flashcards junto: confirmar é o mínimo.
    const confirmed = window.confirm(
      `Remover "${video.title}" da biblioteca? Os flashcards desse vídeo também serão apagados.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível remover agora.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    // Sem elevação nem sombra no hover: card que levanta e projeta sombra
    // cinza é o vocabulário de painel de SaaS, e aqui só somaria ruído. O
    // aviso de que o card responde ao mouse é a borda ficando nítida.
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-bg-elevated transition-colors duration-200 hover:border-border-strong">
      <Link href={`/video/${video.id}`} className="flex flex-col">
        <div className="relative aspect-video w-full overflow-hidden bg-bg-subtle">
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- thumbnail externa do YouTube
            <img
              src={video.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : null}
          {percent > 0 ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30" aria-hidden>
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 p-4">
          <h3 className="line-clamp-2 font-serif text-[15px] font-medium leading-snug text-fg">
            {video.title}
          </h3>

          {/* Sem ícones aqui: relógio ao lado de "15 min" e camadas ao lado de
              "flashcards" não acrescentam nada que a palavra já não diga
              (instrucoes.md §11, "ícones desnecessários"). */}
          <p className="text-[12px] text-fg-muted">
            {LANGUAGE_LABELS[video.sourceLang as "en"] ?? video.sourceLang},{" "}
            {formatDuration(video.durationSec)}
            {video.flashcardCount > 0
              ? `, ${video.flashcardCount} ${video.flashcardCount === 1 ? "flashcard" : "flashcards"}`
              : ""}
          </p>

          {/* Só o que muda a decisão de abrir ou não: onde parei, e se ainda
              falta traduzir. O resto fica de fora. */}
          <p className="text-[12px] text-fg-subtle">
            {percent > 0 ? `${percent}% assistido` : "Ainda não começou"}
            {translated < 100
              ? translated === 0
                ? " — falta traduzir"
                : ` — ${100 - translated}% ainda sem tradução`
              : ""}
            {video.timingsApproximate ? " — sincronia aproximada" : ""}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label={`Remover ${video.title}`}
        title="Remover da biblioteca"
        className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-md bg-bg-elevated/90 text-fg-muted backdrop-blur transition-colors hover:text-danger group-hover:flex disabled:opacity-40"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>

      {error ? (
        <p role="alert" className="px-4 pb-3 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </article>
  );
}
