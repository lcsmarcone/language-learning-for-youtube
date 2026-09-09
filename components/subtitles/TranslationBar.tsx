"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TranslationStatus {
  status: string;
  total: number;
  done: number;
  failed: number;
  error: string | null;
  segmentCount: number;
  translatedCount: number;
}

interface TranslationBarProps {
  trackId: string;
  segmentCount: number;
  translatedCount: number;
  translationConfigured: boolean;
}

/** De quanto em quanto tempo o progresso é consultado enquanto traduz. */
const POLL_MS = 1500;

/**
 * Barra de tradução da tela de estudo.
 *
 * Mostra três situações bem diferentes e não deixa nenhuma delas virar silêncio
 * (instrucoes.md secao 18): falta traduzir, está traduzindo agora, ou alguns
 * trechos falharam. Quando termina, recarrega os dados do servidor para as
 * traduções aparecerem na transcrição.
 */
export function TranslationBar({
  trackId,
  segmentCount,
  translatedCount,
  translationConfigured,
}: TranslationBarProps) {
  const router = useRouter();

  const [status, setStatus] = useState<TranslationStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quantos segmentos o servidor já tinha traduzido quando a página carregou.
  // Comparar com o valor atual é o que diz se vale recarregar.
  const initialTranslated = useRef(translatedCount);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/translate/${trackId}`);
      const payload = await response.json();
      if (!payload.ok) return;

      const next: TranslationStatus = payload.data;
      setStatus(next);

      if (next.status !== "RUNNING") {
        stopPolling();
        // Só recarrega se realmente apareceu tradução nova — evita um refresh
        // à toa toda vez que a tela é aberta.
        if (next.translatedCount > initialTranslated.current) {
          initialTranslated.current = next.translatedCount;
          router.refresh();
        }
      }
    } catch {
      // Falha ao consultar progresso não é erro para o usuário: a tradução
      // segue no servidor e a próxima consulta resolve.
    }
  }, [trackId, router, stopPolling]);

  // Se a página abriu com uma tradução já em andamento (o usuário saiu e
  // voltou), retoma o acompanhamento sozinho.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch(`/api/translate/${trackId}`);
        const payload = await response.json();
        if (!active || !payload.ok) return;

        setStatus(payload.data);
        if (payload.data.status === "RUNNING" && !pollingRef.current) {
          pollingRef.current = setInterval(fetchStatus, POLL_MS);
        }
      } catch {
        // Sem status é o mesmo que "nada em andamento".
      }
    })();

    return () => {
      active = false;
      stopPolling();
    };
  }, [trackId, fetchStatus, stopPolling]);

  async function handleTranslate() {
    setStarting(true);
    setError(null);

    try {
      const response = await fetch(`/api/translate/${trackId}`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!payload.ok) {
        setError(payload.error);
        return;
      }

      setStatus({
        status: "RUNNING",
        total: payload.data.total,
        done: 0,
        failed: 0,
        error: null,
        segmentCount,
        translatedCount: payload.data.alreadyTranslated,
      });

      if (!pollingRef.current) {
        pollingRef.current = setInterval(fetchStatus, POLL_MS);
      }
    } catch {
      setError("Não foi possível iniciar a tradução. Verifique sua conexão.");
    } finally {
      setStarting(false);
    }
  }

  const running = status?.status === "RUNNING";
  const translated = status?.translatedCount ?? translatedCount;
  const missing = Math.max(0, segmentCount - translated);
  const failed = status?.failed ?? 0;

  // Nada a fazer: tudo traduzido e nenhum problema pendente.
  if (!running && missing === 0 && failed === 0 && !error) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-bg-subtle px-4 py-2.5">
      {running ? (
        <>
          <Loader2 size={14} className="animate-spin text-accent" strokeWidth={2} />
          <span className="text-xs text-fg">
            Traduzindo {status.done + status.failed} de {status.total}…
          </span>
          <div
            className="h-1 min-w-24 flex-1 overflow-hidden rounded-full bg-bg-active"
            role="progressbar"
            aria-valuenow={status.done + status.failed}
            aria-valuemin={0}
            aria-valuemax={status.total}
          >
            <div
              className="h-full bg-accent transition-[width] duration-500"
              style={{
                width: `${status.total > 0 ? ((status.done + status.failed) / status.total) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-xs text-fg-subtle">
            Pode continuar assistindo — as frases aparecem quando terminar.
          </span>
        </>
      ) : (
        <>
          <Languages size={14} strokeWidth={1.75} className="text-fg-muted" />
          <span className="text-xs text-fg-muted">
            {missing === segmentCount
              ? "Esta legenda ainda não tem tradução."
              : failed > 0
                ? `${failed} ${failed === 1 ? "trecho não pôde" : "trechos não puderam"} ser traduzido.`
                : `${missing} ${missing === 1 ? "frase ainda está" : "frases ainda estão"} sem tradução.`}
          </span>

          {translationConfigured ? (
            <Button
              size="sm"
              variant="primary"
              onClick={handleTranslate}
              disabled={starting}
              className="ml-auto"
            >
              {starting ? (
                <>
                  <Loader2 size={12} className="animate-spin" strokeWidth={2} />
                  Iniciando…
                </>
              ) : failed > 0 || translated > 0 ? (
                "Traduzir o que falta"
              ) : (
                "Traduzir para português"
              )}
            </Button>
          ) : (
            <span className="ml-auto text-xs text-fg-subtle">
              Configure ANTHROPIC_API_KEY no arquivo .env para traduzir.
            </span>
          )}
        </>
      )}

      {error ? (
        <p
          role="alert"
          className="flex w-full items-start gap-1.5 text-xs leading-relaxed text-danger"
        >
          <AlertCircle size={12} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
