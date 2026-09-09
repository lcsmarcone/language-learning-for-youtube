import { AppHeader } from "@/components/ui/AppHeader";
import { FlashcardsView } from "@/components/flashcards/FlashcardsView";
import { listFlashcards } from "@/services/flashcards";

export const dynamic = "force-dynamic";

export const metadata = { title: "Flashcards — Estudo por vídeo" };

export default async function FlashcardsPage() {
  const cards = await listFlashcards();

  // Filtro por vídeo montado a partir dos próprios cards: só aparecem vídeos
  // que realmente geraram flashcards.
  const byVideo = new Map<string, { id: string; title: string; count: number }>();
  for (const card of cards) {
    const existing = byVideo.get(card.videoId);
    if (existing) {
      existing.count += 1;
    } else {
      byVideo.set(card.videoId, {
        id: card.videoId,
        title: card.videoTitle,
        count: 1,
      });
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <FlashcardsView cards={cards} videos={[...byVideo.values()]} />
      </main>
    </>
  );
}
