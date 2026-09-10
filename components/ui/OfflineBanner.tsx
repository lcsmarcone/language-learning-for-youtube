"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

/**
 * Aviso de conexão perdida (instrucoes.md secao 18).
 *
 * Sem ele, ficar offline aparece como uma sucessão de erros sem explicação: a
 * tradução falha, o flashcard não salva, o progresso some. Um aviso só, no
 * topo, transforma isso em algo compreensível.
 *
 * Estudar continua possível offline — o vídeo já carregado toca e a legenda
 * está na página —, então o aviso informa em vez de bloquear.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineBanner() {
  // `useSyncExternalStore` é a ferramenta certa aqui: o estado da conexão vive
  // fora do React, e assim não existe efeito chamando setState nem risco de a
  // hidratação divergir do servidor (onde assumimos "online").
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-danger/10 px-4 py-1.5 text-xs text-danger"
    >
      <WifiOff size={12} strokeWidth={1.75} />
      Sem conexão. Você pode continuar assistindo, mas traduzir, salvar
      flashcards e gravar o progresso só voltam quando a internet voltar.
    </div>
  );
}
