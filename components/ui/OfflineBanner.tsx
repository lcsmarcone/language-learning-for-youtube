"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Aviso de conexão perdida (instrucoes.md secao 18).
 *
 * Sem ele, ficar offline aparece como uma sucessão de erros sem explicação:
 * a tradução falha, o flashcard não salva, o progresso some. Um aviso só, no
 * topo, transforma isso em algo compreensível.
 *
 * Estudar continua possível offline — o vídeo já carregado toca e a legenda
 * está na página —, então o aviso informa em vez de bloquear.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // O estado inicial só é lido no cliente: no servidor `navigator` não
    // existe, e assumir "online" evita um piscar do aviso na hidratação.
    setOffline(!navigator.onLine);

    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

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
