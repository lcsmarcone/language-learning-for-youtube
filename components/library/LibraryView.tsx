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

  // Separar em seções só ajuda quando há o que separar. Com poucos vídeos, os
  // dois títulos criavam duas fileiras pela metade e a tela parecia inacabada;
  // uma grade só, com o convite no fim, preenche a linha e diz a mesma coisa.
  const sectioned = videos.length >= 4 && inProgress.length > 0;

  return (
    <>
      {videos.length === 0 ? (
        <EmptyState onAdd={() => setDialogOpen(true)} />
      ) : (
        <div className="flex flex-col gap-10">
          <div className="flex items-center justify-between">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-fg">
              Biblioteca
            </h1>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              <Plus size={15} strokeWidth={2} />
              Adicionar vídeo
            </Button>
          </div>

          {sectioned ? (
            <>
              <Section title="Continue estudando" videos={inProgress} />
              <Section
                title="Todos os vídeos"
                videos={rest}
                onAdd={() => setDialogOpen(true)}
              />
            </>
          ) : (
            <Section
              title={null}
              videos={[...inProgress, ...rest]}
              onAdd={() => setDialogOpen(true)}
            />
          )}
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
  onAdd,
}: {
  title: string | null;
  videos: LibraryVideo[];
  /** Quando presente, a grade termina com um convite para adicionar. */
  onAdd?: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <h2 className="text-[13px] font-medium text-fg-muted">{title}</h2>
      ) : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
        {onAdd ? <AddCard onAdd={onAdd} /> : null}
      </div>
    </section>
  );
}

/**
 * Card vazio no fim da grade.
 *
 * Existe por um motivo concreto: com poucos vídeos, a grade de três colunas
 * deixava um vazio grande à direita que parecia tela inacabada. Este card
 * ocupa esse espaço com a ação que o usuário vai querer em seguida — resolve
 * a composição sendo útil, e não decorando.
 */
function AddCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-fg-subtle transition-colors hover:border-accent hover:bg-bg-subtle hover:text-fg"
    >
      <Plus
        size={18}
        strokeWidth={1.5}
        className="transition-transform duration-200 group-hover:scale-110"
      />
      <span className="text-xs">Adicionar outro vídeo</span>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center py-24 text-center">
      <h1 className="text-balance font-serif text-[32px] font-normal leading-[1.25] tracking-tight text-fg">
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
