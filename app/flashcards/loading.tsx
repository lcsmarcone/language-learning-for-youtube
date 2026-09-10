import { AppHeader } from "@/components/ui/AppHeader";
import { Skeleton } from "@/components/ui/Skeleton";

export default function FlashcardsLoading() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-7 w-full" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
