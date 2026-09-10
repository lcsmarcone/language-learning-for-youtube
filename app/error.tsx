"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Tela de erro inesperado (instrucoes.md secao 18 — "não deixe simplesmente
 * erros aparecerem no console").
 *
 * O detalhe técnico vai para o console do servidor/navegador, onde serve para
 * depurar; o usuário recebe algo que ele pode fazer: tentar de novo ou voltar
 * para a biblioteca.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] erro não tratado:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle size={22} strokeWidth={1.5} className="text-fg-subtle" />
      <h1 className="text-lg font-medium tracking-tight text-fg">
        Algo deu errado nesta tela.
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-fg-muted">
        Seus vídeos, traduções e flashcards continuam salvos. Tente de novo — se
        insistir, reinicie o servidor de desenvolvimento.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="primary" onClick={reset}>
          Tentar de novo
        </Button>
        {/* Âncora comum, e não <Link>, de propósito: depois de um erro não
            tratado o roteador do cliente pode estar em estado inconsistente,
            e uma navegação completa é a recuperação mais confiável. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="inline-flex h-9 items-center rounded-md px-4 text-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
        >
          Ir para a biblioteca
        </a>
      </div>
    </main>
  );
}
