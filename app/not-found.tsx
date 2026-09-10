import Link from "next/link";
import { AppHeader } from "@/components/ui/AppHeader";

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <h1 className="text-lg font-medium tracking-tight text-fg">
          Não encontramos esta página.
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-fg-muted">
          O vídeo pode ter sido removido da biblioteca, ou o endereço está
          incorreto.
        </p>
        <Link
          href="/"
          className="mt-2 text-sm text-accent underline underline-offset-4"
        >
          Voltar para a biblioteca
        </Link>
      </main>
    </>
  );
}
