import { Fragment } from "react";
import { splitByRanges, type MarkRange } from "@/lib/selection";

/**
 * Texto de um bloco, com os destaques salvos aplicados.
 *
 * A marcação sai de uma função pura (`splitByRanges`), então este componente
 * só desenha. Isso importa porque o texto aqui é a base dos deslocamentos de
 * caractere da seleção: se a renderização inventasse ou comesse um caractere,
 * todo destaque salvo passaria a apontar para o lugar errado.
 */
export function SegmentText({
  text,
  ranges,
}: {
  text: string;
  ranges: MarkRange[];
}) {
  if (ranges.length === 0) return <>{text}</>;

  return (
    <>
      {splitByRanges(text, ranges).map((piece, index) =>
        piece.marked ? (
          <mark
            key={index}
            className="rounded-[2px] bg-highlight-soft text-fg decoration-clone"
          >
            {piece.text}
          </mark>
        ) : (
          <Fragment key={index}>{piece.text}</Fragment>
        ),
      )}
    </>
  );
}
