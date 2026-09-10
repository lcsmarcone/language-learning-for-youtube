import { Skeleton } from "@/components/ui/Skeleton";

export default function StudyLoading() {
  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="flex flex-col gap-4 border-border p-6 lg:border-r">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex flex-col gap-4 p-4">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
