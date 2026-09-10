"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AddVideoDialog } from "./AddVideoDialog";
import { VideoCard } from "./VideoCard";
import type { LibraryVideo } from "@/services/library";

/**
 * Biblioteca. É client component só porque abre o diálogo de adicionar; a
 * leitura dos dados continua no servidor, em `app/page.tsx`.
 */
export function LibraryView({ videos }: { videos: LibraryVideo[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const inProgress = videos.filter(
    (video) => video.percentComplete > 0 && video.percentComplete < 0.98,
  );
  const rest = videos.filter((video) => !inProgress.includes(video));

  return (
    <>
      {videos.length === 0 ? (
        <EmptyState onAdd={() => setDialogOpen(true)} />
      ) : (
        <div className="flex flex-col gap-10">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium tracking-tight text-fg">
              Biblioteca
            </h1>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              <Plus size={15} strokeWidth={2} />
              Adicionar vídeo
            </Button>
          </div>

          {inProgress.length > 0 ? (
            <Section title="Continue estudando" videos={inProgress} />
          ) : null}

          {rest.length > 0 ? (
            <Section
              title={inProgress.length > 0 ? "Todos os vídeos" : null}
              videos={rest}
            />
          ) : null}
        </div>
      )}

      {/* A `key` amarrada ao estado de aberto remonta o formulário a cada
          abertura. É o que garante que uma tentativa anterior não deixe
          resíduo — sem um efeito de limpeza sincronizando estado à mão. */}
      <AddVideoDialog
        key={dialogOpen ? "aberto" : "fechado"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

function Section({
  title,
  videos,
}: {
  title: string | null;
  videos: LibraryVideo[];
}) {
  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <h2 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
          {title}
        </h2>
      ) : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center py-24 text-center">
      <h1 className="text-balance text-2xl font-medium tracking-tight text-fg">
        Aprenda idiomas com os vídeos que você realmente quer assistir.
      </h1>
      <p className="mt-3 text-pretty text-sm leading-relaxed text-fg-muted">
        Adicione um vídeo, traga a legenda e estude com a tradução
        sincronizada — transformando as frases que importam em flashcards.
      </p>
      <Button variant="primary" onClick={onAdd} className="mt-8">
        <Plus size={15} strokeWidth={2} />
        Adicionar vídeo
      </Button>
    </div>
  );
}
