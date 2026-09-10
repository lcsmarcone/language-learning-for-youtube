"use client";

import { useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownToLine } from "lucide-react";
import type { StudySegment } from "@/lib/domain";
import { usePlayerStore } from "@/lib/playerStore";
import { SegmentRow } from "./SegmentRow";

interface TranscriptListProps {
  segments: StudySegment[];
  onSeek: (segment: StudySegment) => void;
  onPlay: (segment: StudySegment) => void;
  onToggleLoop: (segment: StudySegment) => void;
  onCreateFlashcard: (segment: StudySegment) => void;
}

/**
 * A transcrição.
 *
 * Virtualizada porque um vídeo de uma hora passa de mil blocos e renderizar
 * todos travaria a rolagem (instrucoes.md secao 19).
 *
 * O auto-scroll segue uma regra de respeito ao usuário (secao 13): ele
 * acompanha o vídeo, mas **desliga sozinho** assim que a pessoa rola com a
 * mão. Nada de arrastar a tela de volta enquanto alguém está lendo outro
 * trecho; em vez disso aparece um botão para voltar quando quiser.
 */
export function TranscriptList({
  segments,
  onSeek,
  onPlay,
  onToggleLoop,
  onCreateFlashcard,
}: TranscriptListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeIndex = usePlayerStore((state) => state.activeIndex);
  const loop = usePlayerStore((state) => state.loop);
  const followVideo = usePlayerStore((state) => state.followVideo);
  const scrolledAway = usePlayerStore((state) => state.scrolledAway);
  const setFollowVideo = usePlayerStore((state) => state.setFollowVideo);
  const setScrolledAway = usePlayerStore((state) => state.setScrolledAway);

  // O React Compiler avisa que não consegue memoizar este componente por causa
  // do virtualizador, e está certo. Não é problema aqui: quem repinta a cada
  // frase é o `SegmentRow`, e ele é memoizado por conta própria — este
  // componente só posiciona as linhas.
  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => scrollRef.current,
    // Altura aproximada de um bloco com original + tradução; o virtualizador
    // corrige com a medição real de cada linha.
    estimateSize: () => 92,
    overscan: 8,
    getItemKey: (index) => segments[index].id,
  });

  const scrollToActive = useCallback(() => {
    if (activeIndex < 0) return;
    virtualizer.scrollToIndex(activeIndex, { align: "center" });
  }, [activeIndex, virtualizer]);

  // Acompanha o vídeo enquanto o usuário não interferir.
  useEffect(() => {
    if (!followVideo || activeIndex < 0) return;
    virtualizer.scrollToIndex(activeIndex, { align: "center" });
  }, [activeIndex, followVideo, virtualizer]);

  /**
   * Detecção de rolagem manual.
   *
   * Ouvimos `wheel`, `touchmove` e teclas de navegação — e não o evento
   * `scroll` — porque o `scroll` também dispara com o nosso próprio
   * auto-scroll, o que desligaria o acompanhamento sozinho.
   */
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleManualScroll = () => {
      if (usePlayerStore.getState().followVideo) {
        setFollowVideo(false);
        setScrolledAway(true);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      const navigationKeys = [
        "PageUp",
        "PageDown",
        "Home",
        "End",
        "ArrowUp",
        "ArrowDown",
      ];
      if (navigationKeys.includes(event.key)) handleManualScroll();
    };

    /**
     * Arrastar a barra de rolagem não gera `wheel` nem `touchmove`. O sinal
     * possível é um `mousedown` à direita da área de conteúdo — ou seja, em
     * cima da própria barra.
     */
    const handleMouseDown = (event: MouseEvent) => {
      if (event.offsetX > element.clientWidth) handleManualScroll();
    };

    element.addEventListener("wheel", handleManualScroll, { passive: true });
    element.addEventListener("touchmove", handleManualScroll, { passive: true });
    element.addEventListener("keydown", handleKey);
    element.addEventListener("mousedown", handleMouseDown);

    return () => {
      element.removeEventListener("wheel", handleManualScroll);
      element.removeEventListener("touchmove", handleManualScroll);
      element.removeEventListener("keydown", handleKey);
      element.removeEventListener("mousedown", handleMouseDown);
    };
  }, [setFollowVideo, setScrolledAway]);

  if (segments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="max-w-xs text-sm leading-relaxed text-fg-muted">
          Este vídeo ainda não tem legenda. Adicione-o novamente com um arquivo
          .srt, .vtt ou com a transcrição colada.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        tabIndex={-1}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-2"
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px` }}
          className="relative w-full"
        >
          {virtualizer.getVirtualItems().map((item) => {
            const segment = segments[item.index];
            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <SegmentRow
                  segment={segment}
                  isActive={item.index === activeIndex}
                  isLooping={
                    loop.kind === "segment" && loop.index === item.index
                  }
                  onSeek={onSeek}
                  onPlay={onPlay}
                  onToggleLoop={onToggleLoop}
                  onCreateFlashcard={onCreateFlashcard}
                />
              </div>
            );
          })}
        </div>
      </div>

      {scrolledAway && activeIndex >= 0 ? (
        <button
          type="button"
          onClick={() => {
            setFollowVideo(true);
            scrollToActive();
          }}
          className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-fg shadow-sm transition-colors hover:bg-bg-hover"
        >
          <ArrowDownToLine size={12} strokeWidth={1.75} />
          Voltar para a legenda atual
        </button>
      ) : null}
    </div>
  );
}
