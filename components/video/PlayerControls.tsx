"use client";

import clsx from "clsx";
import {
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { usePlayerStore } from "@/lib/playerStore";
import { formatTimestamp } from "@/lib/time";

const RATES = [0.5, 0.75, 1, 1.25, 1.5];

interface PlayerControlsProps {
  onTogglePlay: () => void;
  onNudge: (deltaMs: number) => void;
  onRateChange: (rate: number) => void;
  onRepeatCurrent: () => void;
}

/**
 * Controles do player.
 *
 * Duplicam o que o iframe do YouTube já oferece por um motivo: aqui eles ficam
 * ligados à transcrição (repetir a frase atual) e ao teclado, e ficam sempre
 * visíveis, sem depender de passar o mouse sobre o vídeo.
 */
export function PlayerControls({
  onTogglePlay,
  onNudge,
  onRateChange,
  onRepeatCurrent,
}: PlayerControlsProps) {
  // Este é o único componente que assina o tempo contínuo. É pequeno de
  // propósito: ele repinta ~10x por segundo, e mais nada na tela repinta junto.
  const currentMs = usePlayerStore((state) => state.currentMs);
  const durationMs = usePlayerStore((state) => state.durationMs);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const loop = usePlayerStore((state) => state.loop);

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      <ControlButton
        label={isPlaying ? "Pausar" : "Reproduzir"}
        onClick={onTogglePlay}
      >
        {isPlaying ? (
          <Pause size={15} strokeWidth={1.75} />
        ) : (
          <Play size={15} strokeWidth={1.75} />
        )}
      </ControlButton>

      <ControlButton label="Voltar 5 segundos" onClick={() => onNudge(-5000)}>
        <RotateCcw size={15} strokeWidth={1.75} />
      </ControlButton>

      <ControlButton label="Avançar 5 segundos" onClick={() => onNudge(5000)}>
        <RotateCw size={15} strokeWidth={1.75} />
      </ControlButton>

      <ControlButton
        label={
          loop.kind === "segment"
            ? "Parar a repetição"
            : "Repetir a frase atual"
        }
        active={loop.kind === "segment"}
        onClick={onRepeatCurrent}
      >
        <Repeat size={15} strokeWidth={1.75} />
      </ControlButton>

      <span className="ml-2 font-mono text-xs tabular-nums text-fg-muted">
        {formatTimestamp(currentMs)}
        <span className="text-fg-subtle">
          {" / "}
          {durationMs > 0 ? formatTimestamp(durationMs) : "--:--"}
        </span>
      </span>

      <div className="ml-auto flex items-center gap-1">
        <span className="mr-1 text-xs text-fg-subtle">Velocidade</span>
        {RATES.map((rate) => (
          <button
            key={rate}
            type="button"
            onClick={() => onRateChange(rate)}
            aria-pressed={playbackRate === rate}
            className={clsx(
              "h-7 rounded px-1.5 font-mono text-[11px] tabular-nums transition-colors",
              playbackRate === rate
                ? "bg-bg-active font-medium text-fg"
                : "text-fg-subtle hover:bg-bg-hover hover:text-fg",
            )}
          >
            {rate}×
          </button>
        ))}
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : "text-fg-muted hover:bg-bg-hover hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
