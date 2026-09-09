"use client";

import { useEffect, useMemo } from "react";
import type { StudySegment } from "@/lib/domain";
import { readSelection, type SelectableSegment } from "@/lib/selection";
import { useSelectionStore } from "@/lib/selectionStore";

/**
 * Liga a seleção do navegador ao estado da aplicação.
 *
 * Ouvimos `mouseup` e `keyup` em vez de `selectionchange` porque este último
 * dispara a cada caractere arrastado — dezenas de vezes por seleção — e nos
 * faria recalcular o objeto inteiro a cada pixel de movimento do mouse. Ao
 * soltar o botão, a seleção já é a final.
 *
 * O Esc limpa a seleção (instrucoes.md secao 14).
 */
export function useSelectionCapture(segments: StudySegment[]) {
  const setSelection = useSelectionStore((state) => state.setSelection);
  const clear = useSelectionStore((state) => state.clear);

  // Mapa id → texto dos dois lados, reconstruído só quando a legenda muda.
  // A tradução entra aqui porque é dela que sai o texto salvo quando a seleção
  // é feita do lado português.
  const segmentsById = useMemo(() => {
    const map = new Map<string, SelectableSegment>();
    for (const segment of segments) {
      map.set(segment.id, {
        index: segment.index,
        text: segment.text,
        translatedText: segment.translatedText,
      });
    }
    return map;
  }, [segments]);

  useEffect(() => {
    const capture = () => {
      const snapshot = readSelection(segmentsById);
      if (snapshot) {
        setSelection(snapshot);
      } else {
        // Sem seleção útil (clique simples, ou seleção misturando os dois
        // lados): some com a barra em vez de deixar um estado antigo na tela.
        clear();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.getSelection()?.removeAllRanges();
        clear();
        return;
      }
      // Seleção por teclado (Shift + setas) também precisa ser capturada.
      if (event.shiftKey || event.key === "a") capture();
    };

    document.addEventListener("mouseup", capture);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("mouseup", capture);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [segmentsById, setSelection, clear]);
}
