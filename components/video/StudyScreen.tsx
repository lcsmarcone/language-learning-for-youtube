"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import type { StudySegment } from "@/lib/domain";
import type { StudyVideo } from "@/services/study";
import { usePlayerStore } from "@/lib/playerStore";
import { resolveLoopSeek } from "@/lib/loop";
import { LANGUAGE_LABELS } from "@/lib/domain";
import { TranscriptList } from "@/components/subtitles/TranscriptList";
import { PlayerControls } from "./PlayerControls";
import { YouTubePlayer, type PlayerHandle } from "./YouTubePlayer";

/** De quanto em quanto tempo o progresso é gravado durante a reprodução. */
const SAVE_INTERVAL_MS = 5000;

/**
 * Tela de estudo: vídeo à esquerda, transcrição à direita (instrucoes.md secao 12).
 *
 * É aqui que as peças se encontram — o player, o store de tempo e a lista
 * virtualizada — e é aqui que moram as duas regras de comportamento que dão
 * identidade ao produto: o loop de repetição e a gravação de progresso.
 */
export function StudyScreen({ video }: { video: StudyVideo }) {
  const playerRef = useRef<PlayerHandle>(null);
  const durationSecRef = useRef<number | null>(video.durationSec);

  const setSegments = usePlayerStore((state) => state.setSegments);
  const setPlaybackRate = usePlayerStore((state) => state.setPlaybackRate);
  const setLoop = usePlayerStore((state) => state.setLoop);
  const toggleSegmentLoop = usePlayerStore((state) => state.toggleSegmentLoop);
  const followVideo = usePlayerStore((state) => state.followVideo);
  const setFollowVideo = usePlayerStore((state) => state.setFollowVideo);

  // Carrega os segmentos no store e limpa o estado ao sair, para o próximo
  // vídeo não herdar destaque nem loop deste.
  useEffect(() => {
    setSegments(video.segments);
    setLoop({ kind: "none" });
    return () => {
      usePlayerStore.setState({
        segments: [],
        activeIndex: -1,
        currentMs: 0,
        durationMs: 0,
        loop: { kind: "none" },
        followVideo: true,
        scrolledAway: false,
      });
    };
  }, [video.segments, setSegments, setLoop]);

  /**
   * Motor do loop de repetição.
   *
   * Assina o store fora do React de propósito: reagir ao tempo dentro de um
   * componente faria a tela re-renderizar dez vezes por segundo só para
   * verificar um limite.
   */
  useEffect(() => {
    return usePlayerStore.subscribe((state, previous) => {
      if (state.currentMs === previous.currentMs) return;

      const target = resolveLoopSeek(state.loop, state.currentMs, state.segments);
      if (target !== null) {
        playerRef.current?.seekToMs(target, { play: true });
      }
    });
  }, []);

  /**
   * Gravação de progresso: a cada 5 s enquanto toca, e uma última vez quando a
   * aba some. O `sendBeacon` é o que garante essa última gravação — um `fetch`
   * comum é cancelado quando a página fecha.
   */
  useEffect(() => {
    const save = (useBeacon: boolean) => {
      const state = usePlayerStore.getState();
      const lastPositionMs = Math.round(state.currentMs);
      if (lastPositionMs <= 0) return;

      const payload = JSON.stringify({
        lastPositionMs,
        durationSec: durationSecRef.current,
      });
      const url = `/api/videos/${video.id}/progress`;

      if (useBeacon && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
        return;
      }

      void fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Progresso é conveniência: falhar em salvar não pode interromper o
        // estudo nem virar erro na tela.
      });
    };

    const interval = setInterval(() => {
      if (usePlayerStore.getState().isPlaying) save(false);
    }, SAVE_INTERVAL_MS);

    const handleHide = () => save(true);
    window.addEventListener("pagehide", handleHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") save(true);
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", handleHide);
      save(true);
    };
  }, [video.id]);

  const handleSeek = useCallback((segment: StudySegment) => {
    playerRef.current?.seekToMs(segment.startMs);
  }, []);

  const handlePlaySegment = useCallback((segment: StudySegment) => {
    // Tocar uma frase específica cancela um loop anterior: senão o vídeo
    // saltaria de volta para a frase antiga no quadro seguinte.
    usePlayerStore.getState().setLoop({ kind: "none" });
    playerRef.current?.seekToMs(segment.startMs, { play: true });
  }, []);

  const handleToggleLoop = useCallback(
    (segment: StudySegment) => {
      toggleSegmentLoop(segment.index);

      const loop = usePlayerStore.getState().loop;
      if (loop.kind === "segment" && loop.index === segment.index) {
        playerRef.current?.seekToMs(segment.startMs, { play: true });
      }
    },
    [toggleSegmentLoop],
  );

  const handleRepeatCurrent = useCallback(() => {
    const state = usePlayerStore.getState();

    if (state.loop.kind !== "none") {
      state.setLoop({ kind: "none" });
      return;
    }

    const index =
      state.activeIndex >= 0 ? state.activeIndex : state.segments.length > 0 ? 0 : -1;
    if (index < 0) return;

    state.setLoop({ kind: "segment", index });
    playerRef.current?.seekToMs(state.segments[index].startMs, { play: true });
  }, []);

  const handleRateChange = useCallback(
    (rate: number) => {
      playerRef.current?.setRate(rate);
      setPlaybackRate(rate);
    },
    [setPlaybackRate],
  );

  const untranslated = video.segments.length - video.translatedCount;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          Biblioteca
        </Link>
        <h1 className="min-w-0 truncate text-sm font-medium text-fg">
          {video.title}
        </h1>
        <span className="ml-auto shrink-0 text-xs text-fg-subtle">
          {LANGUAGE_LABELS[video.sourceLang as "en"] ?? video.sourceLang} →{" "}
          {LANGUAGE_LABELS["pt-BR"]}
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <section className="flex min-w-0 flex-col gap-4 border-border p-6 lg:border-r">
          {video.externalId ? (
            <YouTubePlayer
              ref={playerRef}
              videoId={video.externalId}
              startAtMs={video.lastPositionMs}
              onDurationKnown={(durationSec) => {
                durationSecRef.current = durationSec;
              }}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-bg-subtle text-sm text-fg-muted">
              Este vídeo não tem uma fonte reproduzível.
            </div>
          )}

          <PlayerControls
            onTogglePlay={() => playerRef.current?.togglePlay()}
            onNudge={(delta) => playerRef.current?.nudgeMs(delta)}
            onRateChange={handleRateChange}
            onRepeatCurrent={handleRepeatCurrent}
          />

          {video.timingsApproximate ? (
            <p className="flex items-start gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs leading-relaxed text-fg-muted">
              <Clock3 size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              Os tempos desta legenda foram estimados a partir do texto, então a
              sincronia é aproximada.
            </p>
          ) : null}
        </section>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
            <span className="text-xs text-fg-subtle">
              {video.segments.length}{" "}
              {video.segments.length === 1 ? "bloco" : "blocos"}
              {untranslated > 0 && video.segments.length > 0 ? (
                <>
                  {" · "}
                  {video.translatedCount === 0
                    ? "sem tradução ainda"
                    : `${untranslated} sem tradução`}
                </>
              ) : null}
            </span>

            <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-fg-muted">
              <input
                type="checkbox"
                checked={followVideo}
                onChange={(event) => setFollowVideo(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              Acompanhar vídeo
            </label>
          </div>

          <TranscriptList
            segments={video.segments}
            onSeek={handleSeek}
            onPlay={handlePlaySegment}
            onToggleLoop={handleToggleLoop}
          />
        </section>
      </div>
    </div>
  );
}
