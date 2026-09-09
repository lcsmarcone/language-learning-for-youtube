"use client";

import { create } from "zustand";
import type { SelectionSnapshot, StoredHighlight } from "@/lib/selection";

/**
 * Estado da seleção, separado do estado do player.
 *
 * Está num store próprio pelo mesmo motivo do tempo do vídeo: a lista de
 * legendas é virtualizada e memoizada, e cada bloco precisa saber **só** se ele
 * participa da seleção atual. Passar a seleção por props obrigaria a lista
 * inteira a re-renderizar a cada arrasto do mouse.
 */

interface SelectionState {
  current: SelectionSnapshot | null;
  /** Ids dos blocos tocados pela seleção — conjunto para consulta barata. */
  selectedIds: ReadonlySet<string>;

  /** Destaques salvos, por id de bloco. */
  highlights: StoredHighlight[];

  setSelection: (selection: SelectionSnapshot | null) => void;
  clear: () => void;
  setHighlights: (highlights: StoredHighlight[]) => void;
  addHighlight: (highlight: StoredHighlight) => void;
  removeHighlight: (id: string) => void;
}

const EMPTY: ReadonlySet<string> = new Set();

export const useSelectionStore = create<SelectionState>((set) => ({
  current: null,
  selectedIds: EMPTY,
  highlights: [],

  setSelection: (selection) =>
    set({
      current: selection,
      selectedIds: selection ? new Set(selection.segmentIds) : EMPTY,
    }),

  clear: () => set({ current: null, selectedIds: EMPTY }),

  setHighlights: (highlights) => set({ highlights }),

  addHighlight: (highlight) =>
    set((state) => ({ highlights: [...state.highlights, highlight] })),

  removeHighlight: (id) =>
    set((state) => ({
      highlights: state.highlights.filter((highlight) => highlight.id !== id),
    })),
}));
