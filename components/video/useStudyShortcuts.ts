"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/playerStore";
import { useSelectionStore } from "@/lib/selectionStore";
import { matchShortcut, shouldIgnoreShortcut } from "@/lib/shortcuts";
import type { StudySegment } from "@/lib/domain";
import type { PlayerHandle } from "./YouTubePlayer";

interface Options {
  playerRef: React.RefObject<PlayerHandle | null>;
  onSeekSegment: (segment: StudySegment) => void;
  onRepeatCurrent: () => void;
  onCreateFlashcard: (segment: StudySegment) => void;
  onShowHelp: () => void;
  onMessage: (message: string) => void;
}

/**
 * Teclado da tela de estudo.
 *
 * Lê o estado direto do store, sem assinar nada: um atalho é um evento
 * pontual, e assinar o tempo aqui faria a tela re-renderizar dez vezes por
 * segundo só para o teclado estar pronto.
 */
export function useStudyShortcuts({
  playerRef,
  onSeekSegment,
  onRepeatCurrent,
  onCreateFlashcard,
  onShowHelp,
  onMessage,
}: Options) {
  /** Primeiro ponto do loop A-B, enquanto o segundo não é marcado. */
  const pendingAbStartRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcut(event.target)) return;

      const action = matchShortcut(event);
      if (!action) return;

      const state = usePlayerStore.getState();
      const player = playerRef.current;

      // O índice de referência: o bloco tocando agora, ou o primeiro se o
      // vídeo ainda nem começou.
      const currentIndex = state.activeIndex >= 0 ? state.activeIndex : 0;
      const segments = state.segments;

      switch (action) {
        case "togglePlay":
          // Sem isto, a barra de espaço rola a página junto.
          event.preventDefault();
          player?.togglePlay();
          break;

        case "back":
          event.preventDefault();
          player?.nudgeMs(-5000);
          break;

        case "forward":
          event.preventDefault();
          player?.nudgeMs(5000);
          break;

        case "previousSegment": {
          event.preventDefault();
          const target = segments[currentIndex - 1];
          if (target) onSeekSegment(target);
          break;
        }

        case "nextSegment": {
          event.preventDefault();
          const target = segments[currentIndex + 1];
          if (target) onSeekSegment(target);
          break;
        }

        case "repeatSegment":
          event.preventDefault();
          pendingAbStartRef.current = null;
          onRepeatCurrent();
          break;

        case "markAb": {
          event.preventDefault();
          const segment = segments[currentIndex];
          if (!segment) break;

          // Já havia um loop rodando: a tecla desfaz, em vez de empilhar.
          if (state.loop.kind !== "none") {
            state.setLoop({ kind: "none" });
            pendingAbStartRef.current = null;
            onMessage("Repetição desligada");
            break;
          }

          if (pendingAbStartRef.current === null) {
            pendingAbStartRef.current = segment.startMs;
            onMessage("Início marcado — pressione A de novo no fim do trecho");
            break;
          }

          const startMs = pendingAbStartRef.current;
          const endMs = segment.endMs;
          pendingAbStartRef.current = null;

          if (endMs <= startMs) {
            onMessage("O fim do trecho precisa vir depois do início");
            break;
          }

          state.setLoop({ kind: "ab", startMs, endMs });
          player?.seekToMs(startMs, { play: true });
          onMessage("Repetindo o trecho marcado");
          break;
        }

        case "createFlashcard": {
          event.preventDefault();
          const selection = useSelectionStore.getState().current;
          if (selection) {
            // Há seleção: o botão da barra inferior é quem sabe montá-la.
            document
              .querySelector<HTMLButtonElement>("[data-shortcut='create-flashcard']")
              ?.click();
            break;
          }

          const segment = segments[currentIndex];
          if (segment) onCreateFlashcard(segment);
          break;
        }

        case "cancel": {
          const selection = useSelectionStore.getState().current;
          if (selection) {
            window.getSelection()?.removeAllRanges();
            useSelectionStore.getState().clear();
            break;
          }
          if (state.loop.kind !== "none") {
            state.setLoop({ kind: "none" });
            pendingAbStartRef.current = null;
            onMessage("Repetição desligada");
          }
          break;
        }

        case "help":
          event.preventDefault();
          onShowHelp();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    playerRef,
    onSeekSegment,
    onRepeatCurrent,
    onCreateFlashcard,
    onShowHelp,
    onMessage,
  ]);
}
