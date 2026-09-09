"use client";

import { create } from "zustand";
import type { StudySegment } from "@/lib/domain";
import { resolveHighlightedIndex } from "@/lib/sync";

/**
 * Estado do player, fora do React.
 *
 * Este arquivo existe por causa de um requisito explícito de performance
 * (instrucoes.md secao 19): a sincronia do vídeo não pode re-renderizar a
 * aplicação inteira várias vezes por segundo.
 *
 * A regra que governa o desenho:
 *
 * - `currentMs` muda ~10x por segundo. Só quem realmente precisa do tempo
 *   contínuo (o relógio e a barra de progresso) assina esse campo.
 * - `activeIndex` muda no máximo uma vez por frase. É ele que a transcrição
 *   assina — e como a lista é virtualizada, uma mudança repinta duas linhas,
 *   não mil.
 */

export type LoopMode =
  | { kind: "none" }
  | { kind: "segment"; index: number }
  | { kind: "ab"; startMs: number; endMs: number };

interface PlayerState {
  segments: StudySegment[];

  currentMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;

  activeIndex: number;
  loop: LoopMode;

  /** Quando ligado, a transcrição rola sozinha atrás do vídeo. */
  followVideo: boolean;
  /** Ligado quando o usuário rolou para longe da legenda atual. */
  scrolledAway: boolean;

  setSegments: (segments: StudySegment[]) => void;
  setTime: (ms: number) => void;
  setDuration: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;

  setLoop: (loop: LoopMode) => void;
  toggleSegmentLoop: (index: number) => void;

  setFollowVideo: (follow: boolean) => void;
  setScrolledAway: (away: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  segments: [],

  currentMs: 0,
  durationMs: 0,
  isPlaying: false,
  playbackRate: 1,

  activeIndex: -1,
  loop: { kind: "none" },

  followVideo: true,
  scrolledAway: false,

  setSegments: (segments) => set({ segments, activeIndex: -1 }),

  /**
   * Chamado pelo laço de animação. Escreve `activeIndex` apenas quando ele
   * muda de verdade — é o que evita uma renderização por quadro.
   */
  setTime: (ms) => {
    const state = get();
    const nextIndex = resolveHighlightedIndex(
      state.segments,
      ms,
      state.activeIndex,
    );

    if (nextIndex === state.activeIndex) {
      set({ currentMs: ms });
    } else {
      set({ currentMs: ms, activeIndex: nextIndex });
    }
  },

  setDuration: (durationMs) => set({ durationMs }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),

  setLoop: (loop) => set({ loop }),

  /** Liga o loop naquela frase, ou desliga se já era ela que estava em loop. */
  toggleSegmentLoop: (index) => {
    const { loop } = get();
    const alreadyLooping = loop.kind === "segment" && loop.index === index;
    set({ loop: alreadyLooping ? { kind: "none" } : { kind: "segment", index } });
  },

  setFollowVideo: (followVideo) =>
    set({ followVideo, scrolledAway: followVideo ? false : get().scrolledAway }),
  setScrolledAway: (scrolledAway) => set({ scrolledAway }),
}));

// Gancho de depuração: em desenvolvimento, o store fica acessível no console
// do navegador. É a única forma prática de inspecionar tempo e loop enquanto o
// vídeo toca, já que nada disso passa por estado do React.
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __playerStore?: unknown }).__playerStore =
    usePlayerStore;
}

/** Seletores prontos, para nenhum componente assinar mais do que precisa. */
export const selectActiveIndex = (state: PlayerState) => state.activeIndex;
export const selectIsPlaying = (state: PlayerState) => state.isPlaying;
export const selectLoop = (state: PlayerState) => state.loop;
