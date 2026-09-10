/**
 * Blocos cinza de carregamento.
 *
 * Servem para a tela não "pular" quando os dados chegam: o esqueleto ocupa
 * aproximadamente o mesmo espaço do conteúdo real.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-bg-hover ${className}`}
      aria-hidden
    />
  );
}
