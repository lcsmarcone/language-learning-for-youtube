"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { Check, X } from "lucide-react";
import clsx from "clsx";

/**
 * Aviso curto de confirmação.
 *
 * Existe porque copiar não tem retorno visual nenhum por natureza: sem um
 * "copiado", o usuário fica sem saber se o clique funcionou e clica de novo
 * (instrucoes.md secao 11 — feedback visual imediato).
 */

interface ToastState {
  message: string | null;
  tone: "success" | "error";
  show: (message: string, tone?: "success" | "error") => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: "success",
  show: (message, tone = "success") => set({ message, tone }),
  hide: () => set({ message: null }),
}));

const VISIBLE_MS = 2200;

export function Toaster() {
  const message = useToast((state) => state.message);
  const tone = useToast((state) => state.tone);
  const hide = useToast((state) => state.hide);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, hide]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
    >
      <div
        className={clsx(
          "flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-lg",
          tone === "success"
            ? "border-border bg-bg-elevated text-fg"
            : "border-danger/40 bg-bg-elevated text-danger",
        )}
      >
        {tone === "success" ? (
          <Check size={13} strokeWidth={2.25} className="text-success" />
        ) : (
          <X size={13} strokeWidth={2.25} />
        )}
        {message}
      </div>
    </div>
  );
}
