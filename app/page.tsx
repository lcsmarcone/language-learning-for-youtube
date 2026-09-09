import { AppHeader } from "@/components/ui/AppHeader";
import { LibraryView } from "@/components/library/LibraryView";
import { listLibrary } from "@/services/library";

// A biblioteca reflete o banco local; nada aqui pode ser servido de cache.
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const videos = await listLibrary();

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <LibraryView videos={videos} />
      </main>
    </>
  );
}
