"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AlertTriangle } from "lucide-react";
import {
  describePlayerError,
  loadYouTubeApi,
  YT_STATE,
  type YouTubePlayerInstance,
} from "@/lib/youtubeIframe";
import { usePlayerStore } from "@/lib/playerStore";
import { secondsToMs } from "@/lib/time";

/** O que a tela de estudo pode pedir ao player. */
export interface PlayerHandle {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekToMs(ms: number, options?: { play?: boolean }): void;
  nudgeMs(deltaMs: number): void;
  setRate(rate: number): void;
  getTimeMs(): number;
}

interface YouTubePlayerProps {
  videoId: string;
  /** Instante inicial, para retomar de onde o usuário parou. */
  startAtMs?: number;
  /** Avisa a duração assim que o player a conhece (o oEmbed não informa). */
  onDurationKnown?: (durationSec: number) => void;
}

/**
 * Player do YouTube.
 *
 * Fala com o mundo por `ref` imperativa, de propósito: os comandos são eventos
 * ("vá para 3:17", "toque"), não estado derivado. Modelar isso como prop faria
 * a árvore inteira re-renderizar a cada clique numa legenda.
 *
 * O laço de tempo vive aqui porque é aqui que está o player — e ele escreve
 * direto no store, sem passar por estado do React.
 */
export const YouTubePlayer = forwardRef<PlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, startAtMs = 0, onDurationKnown }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YouTubePlayerInstance | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const setTime = usePlayerStore((state) => state.setTime);
    const setPlaying = usePlayerStore((state) => state.setPlaying);
    const setDuration = usePlayerStore((state) => state.setDuration);

    // Guardamos o instante inicial num ref: mudanças posteriores no prop não
    // devem recriar o player (o que reiniciaria o vídeo do zero).
    const startAtRef = useRef(startAtMs);
    const onDurationRef = useRef(onDurationKnown);
    onDurationRef.current = onDurationKnown;

    useEffect(() => {
      let cancelled = false;

      loadYouTubeApi()
        .then((api) => {
          if (cancelled || !containerRef.current) return;

          playerRef.current = new api.Player(containerRef.current, {
            videoId,
            playerVars: {
              // `rel: 0` mantém as sugestões do fim dentro do mesmo canal;
              // `modestbranding` reduz o ruído visual sobre o vídeo.
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              // Desliga a legenda do próprio YouTube: nós já mostramos a
              // legenda ao lado, e as duas juntas competem pela atenção — sem
              // contar que a do YouTube costuma vir em outro idioma.
              cc_load_policy: 0,
              start: Math.floor(startAtRef.current / 1000),
            },
            events: {
              onReady: (event) => {
                if (cancelled) return;
                setReady(true);

                const durationSec = event.target.getDuration();
                if (durationSec > 0) {
                  setDuration(secondsToMs(durationSec));
                  onDurationRef.current?.(Math.round(durationSec));
                }

                if (startAtRef.current > 0) {
                  event.target.seekTo(startAtRef.current / 1000, true);
                }
              },
              onStateChange: (event) => {
                if (cancelled) return;
                setPlaying(event.data === YT_STATE.PLAYING);

                // A duração só fica confiável depois que o vídeo começa a
                // carregar de fato.
                const player = playerRef.current;
                if (player) {
                  const durationSec = player.getDuration();
                  if (durationSec > 0) {
                    setDuration(secondsToMs(durationSec));
                    onDurationRef.current?.(Math.round(durationSec));
                  }
                }
              },
              onError: (event) => {
                if (cancelled) return;
                setError(describePlayerError(event.data));
              },
            },
          });
        })
        .catch((loadError: Error) => {
          if (!cancelled) setError(loadError.message);
        });

      return () => {
        cancelled = true;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
      // Recriar o player só faz sentido se o vídeo mudar.
    }, [videoId, setDuration, setPlaying]);

    /**
     * Laço de tempo: lê o relógio do player ~10x por segundo.
     *
     * É `setInterval`, e não `requestAnimationFrame`, por um motivo concreto
     * descoberto testando o app: o navegador **congela o rAF em abas em
     * segundo plano**. O vídeo do YouTube continua tocando (o áudio segue), e
     * a transcrição pararia de acompanhar — e o loop de repetição pararia de
     * voltar ao início. Com intervalo, a aba em segundo plano é apenas
     * desacelerada para ~1 leitura por segundo, e tudo continua funcionando.
     *
     * 100 ms é o equilíbrio: mais rápido não muda nada visualmente e só gasta
     * bateria; mais lento deixa o fim do loop impreciso.
     */
    useEffect(() => {
      if (!ready) return;

      const TICK_MS = 100;

      const tick = () => {
        const player = playerRef.current;
        if (!player) return;

        const seconds = player.getCurrentTime();
        if (typeof seconds === "number" && Number.isFinite(seconds)) {
          setTime(secondsToMs(seconds));
        }
      };

      tick();
      const interval = setInterval(tick, TICK_MS);
      return () => clearInterval(interval);
    }, [ready, setTime]);

    useImperativeHandle(
      ref,
      (): PlayerHandle => ({
        play: () => playerRef.current?.playVideo(),
        pause: () => playerRef.current?.pauseVideo(),
        togglePlay: () => {
          const player = playerRef.current;
          if (!player) return;
          if (player.getPlayerState() === YT_STATE.PLAYING) {
            player.pauseVideo();
          } else {
            player.playVideo();
          }
        },
        seekToMs: (ms, options) => {
          const player = playerRef.current;
          if (!player) return;
          player.seekTo(Math.max(0, ms) / 1000, true);
          // O laço só leria o novo tempo no próximo quadro; escrever aqui faz
          // o destaque acompanhar o clique imediatamente.
          setTime(Math.max(0, ms));
          if (options?.play) player.playVideo();
        },
        nudgeMs: (deltaMs) => {
          const player = playerRef.current;
          if (!player) return;
          const target = Math.max(0, player.getCurrentTime() * 1000 + deltaMs);
          player.seekTo(target / 1000, true);
          setTime(target);
        },
        setRate: (rate) => playerRef.current?.setPlaybackRate(rate),
        getTimeMs: () =>
          playerRef.current ? secondsToMs(playerRef.current.getCurrentTime()) : 0,
      }),
      [setTime],
    );

    if (error) {
      return (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-bg-subtle p-6 text-center">
          <AlertTriangle size={20} strokeWidth={1.5} className="text-fg-subtle" />
          <p className="max-w-sm text-sm leading-relaxed text-fg-muted">
            {error}
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent underline underline-offset-2"
          >
            Abrir no YouTube
          </a>
        </div>
      );
    }

    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        {/* A API substitui esta div pelo iframe do player. */}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    );
  },
);
