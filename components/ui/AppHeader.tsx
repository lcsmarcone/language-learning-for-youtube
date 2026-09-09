import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Cabeçalho global. Deliberadamente mínimo: duas rotas e o toggle de tema.
 * Nada de menu gigante (instrucoes.md §11).
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
        <Link
          href="/"
          className="text-sm font-medium tracking-tight text-fg hover:text-accent"
        >
          Estudo por vídeo
        </Link>
        <nav className="flex items-center gap-4 text-sm text-fg-muted">
          <Link href="/" className="transition-colors hover:text-fg">
            Biblioteca
          </Link>
          <Link href="/flashcards" className="transition-colors hover:text-fg">
            Flashcards
          </Link>
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
