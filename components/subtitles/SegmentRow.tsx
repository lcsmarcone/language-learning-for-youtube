"use client";

import { memo, useRef } from "react";
import clsx from "clsx";
import { Play, Repeat, Star } from "lucide-react";
import type { StudySegment } from "@/lib/domain";
import { formatTimestamp } from "@/lib/time";
import { useSelectionStore } from "@/lib/selectionStore";
import { segmentMarkRanges } from "@/lib/selection";
import { SegmentText } from "./SegmentText";

interface SegmentRowProps {
  segment: StudySegment;
  isActive: boolean;
  isLooping: boolean;
  onSeek: (segment: StudySegment) => void;
  onPlay: (segment: StudySegment) => void;
  onToggleLoop: (segment: StudySegment) => void;
  onCreateFlashcard: (segment: StudySegment) => void;
}

/** Distância em pixels a partir da qual um clique vira arrasto (seleção). */
const DRAG_THRESHOLD_PX = 4;

/**
 * Um bloco da transcrição: tempo, texto original e tradução.
 *
 * O ponto delicado deste componente é o conflito entre **clicar para navegar**
 * e **selecionar texto** (instrucoes.md, "Comportamento da legenda"). A
 * solução tem duas guardas, e ambas são necessárias:
 *
 * 1. se o mouse andou mais que alguns pixels entre apertar e soltar, foi
 *    arrasto — o usuário estava selecionando;
 * 2. se sobrou qualquer seleção de texto na página ao soltar, também não é
 *    clique de navegação.
 *
 * Só quando as duas passam é que o vídeo pula para o tempo do bloco.
 *
 * `memo` não é enfeite: enquanto o vídeo toca, o pai re-renderiza a cada
 * mudança de frase, e sem isso todas as linhas visíveis seriam refeitas.
 */
export const SegmentRow = memo(function SegmentRow({
  segment,
  isActive,
  isLooping,
  onSeek,
  onPlay,
  onToggleLoop,
  onCreateFlashcard,
}: SegmentRowProps) {
  const pressRef = useRef<{ x: number; y: number } | null>(null);

  // Assinaturas estreitas de propósito: cada bloco só quer saber se ele
  // participa da seleção atual, não qual é a seleção.
  const inSelection = useSelectionStore((state) =>
    state.selectedIds.has(segment.id),
  );
  const selectionSide = useSelectionStore((state) => state.current?.side ?? null);
  const highlights = useSelectionStore((state) => state.highlights);

  const markRanges = segmentMarkRanges(segment, highlights);

  // Enquanto o usuário seleciona de um lado, o outro lado inteiro é destacado.
  // Segmento inteiro, e não recorte: não existe alinhamento palavra a palavra
  // confiável entre original e tradução (instrucoes.md secao 6).
  const mirrorOriginal = inSelection && selectionSide === "translation";
  const mirrorTranslation = inSelection && selectionSide === "original";

  function handleMouseDown(event: React.MouseEvent) {
    pressRef.current = { x: event.clientX, y: event.clientY };
  }

  function handleMouseUp(event: React.MouseEvent) {
    const press = pressRef.current;
    pressRef.current = null;
    if (!press) return;

    const moved =
      Math.abs(event.clientX - press.x) > DRAG_THRESHOLD_PX ||
      Math.abs(event.clientY - press.y) > DRAG_THRESHOLD_PX;
    if (moved) return;

    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) return;

    onSeek(segment);
  }

  return (
    <div
      data-segment-id={segment.id}
      data-segment-index={segment.index}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={clsx(
        // O destaque da frase ativa é um trilho na lateral, e não um bloco de
        // cor cheia: o bloco competia com o vídeo pela atenção, e o trilho diz
        // a mesma coisa sem gritar.
        "group relative cursor-pointer scroll-mt-24 rounded-r-md border-l-2 py-3 pl-4 pr-3 transition-colors duration-150",
        isActive
          ? "border-l-accent bg-accent-subtle/50"
          : "border-l-transparent hover:bg-bg-hover",
        isLooping && "border-l-accent bg-accent-subtle/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            "mt-[3px] w-10 shrink-0 select-none font-mono text-[10px] tracking-tight tabular-nums transition-colors",
            isActive
              ? "text-accent"
              : "text-fg-subtle/70 group-hover:text-fg-subtle",
          )}
        >
          {formatTimestamp(segment.startMs)}
        </span>

        <div className="min-w-0 flex-1">
          <p
            data-role="original"
            className={clsx(
              "font-serif text-[17px] leading-[1.5] text-fg",
              mirrorOriginal && "rounded-sm bg-highlight-soft/60",
            )}
          >
            <SegmentText text={segment.text} ranges={markRanges} />
          </p>

          {segment.translatedText ? (
            <p
              data-role="translation"
              className={clsx(
                "mt-1.5 text-[13.5px] leading-[1.55] text-fg-muted",
                mirrorTranslation && "rounded-sm bg-highlight-soft/60 text-fg",
              )}
            >
              {segment.translatedText}
            </p>
          ) : segment.translationStatus === "FAILED" ? (
            <p className="mt-1 text-xs text-fg-subtle">
              Tradução indisponível para este trecho.
            </p>
          ) : null}
        </div>

        {/* Ações rápidas no hover. Ficam fora do fluxo do texto para não
            atrapalhar a seleção. */}
        <div
          className={clsx(
            "flex shrink-0 items-center gap-0.5 transition-opacity duration-150",
            isLooping
              ? "opacity-100"
              : "opacity-0 focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <IconAction
            label="Reproduzir a partir daqui"
            onClick={() => onPlay(segment)}
          >
            <Play size={13} strokeWidth={1.75} />
          </IconAction>
          <IconAction
            label={isLooping ? "Parar a repetição" : "Repetir esta frase"}
            active={isLooping}
            onClick={() => onToggleLoop(segment)}
          >
            <Repeat size={13} strokeWidth={1.75} />
          </IconAction>
          <IconAction
            label="Criar flashcard desta frase"
            onClick={() => onCreateFlashcard(segment)}
          >
            <Star size={13} strokeWidth={1.75} />
          </IconAction>
        </div>
      </div>
    </div>
  );
});

function IconAction({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={clsx(
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : "text-fg-subtle hover:bg-bg-active hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
