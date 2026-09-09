import { AppHeader } from "@/components/ui/AppHeader";

export default function LibraryPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16">
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-balance text-2xl font-medium tracking-tight text-fg">
            Aprenda idiomas com os vídeos que você realmente quer assistir.
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-fg-muted">
            Adicione um vídeo, importe a legenda e estude com tradução
            sincronizada — transformando as frases que importam em flashcards.
          </p>
          <button
            type="button"
            disabled
            className="mt-8 inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-opacity disabled:opacity-40"
          >
            Adicionar vídeo
          </button>
          <p className="mt-3 text-xs text-fg-subtle">
            Disponível na etapa 3 do desenvolvimento.
          </p>
        </div>
      </main>
    </>
  );
}
