"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { FlashcardCard } from "./FlashcardCard";
import type { FlashcardView } from "@/services/flashcards";

interface FlashcardsViewProps {
  cards: FlashcardView[];
  videos: Array<{ id: string; title: string; count: number }>;
}

/**
 * Área de flashcards (instrucoes.md secao 7).
 *
 * Filtro e busca acontecem no cliente porque a lista é do próprio usuário e
 * cabe na memória — e assim digitar na busca é instantâneo, sem ida ao
 * servidor a cada tecla.
 */
export function FlashcardsView({ cards, videos }: FlashcardsViewProps) {
  const [items, setItems] = useState(cards);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return items.filter((card) => {
      if (videoId && card.videoId !== videoId) return false;
      if (term.length === 0) return true;
      return (
        card.front.toLowerCase().includes(term) ||
        card.back.toLowerCase().includes(term) ||
        card.videoTitle.toLowerCase().includes(term)
      );
    });
  }, [items, videoId, query]);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center py-24 text-center">
        <h1 className="text-xl font-medium tracking-tight text-fg">
          Nenhum flashcard ainda.
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-fg-muted">
          Enquanto estuda, selecione uma frase na transcrição e clique em
          “Criar flashcard” — ou use a estrela que aparece ao passar o mouse
          sobre um bloco da legenda.
        </p>
        <Link
          href="/"
          className="mt-6 text-sm text-accent underline underline-offset-4"
        >
          Ir para a biblioteca
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium tracking-tight text-fg">
          Flashcards
          <span className="ml-2 text-sm font-normal text-fg-subtle">
            {filtered.length === items.length
              ? items.length
              : `${filtered.length} de ${items.length}`}
          </span>
        </h1>

        <label className="relative">
          <Search
            size={13}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar nos flashcards"
            className="h-8 w-56 rounded-md border border-border bg-bg pl-7 pr-3 text-xs text-fg placeholder:text-fg-subtle"
          />
        </label>
      </div>

      {videos.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label={`Todos (${items.length})`}
            active={videoId === null}
            onClick={() => setVideoId(null)}
          />
          {videos.map((video) => (
            <FilterChip
              key={video.id}
              label={`${video.title} (${video.count})`}
              active={videoId === video.id}
              onClick={() => setVideoId(video.id)}
            />
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg-muted">
          Nenhum flashcard corresponde a essa busca.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((card) => (
            <FlashcardCard
              key={card.id}
              card={card}
              onDeleted={(id) =>
                setItems((current) => current.filter((item) => item.id !== id))
              }
              onUpdated={(updated) =>
                setItems((current) =>
                  current.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "max-w-64 truncate rounded-full border border-accent bg-accent-subtle px-3 py-1 text-xs font-medium text-fg"
          : "max-w-64 truncate rounded-full border border-border px-3 py-1 text-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
      }
    >
      {label}
    </button>
  );
}
