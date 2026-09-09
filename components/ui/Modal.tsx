"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Diálogo construído sobre o `<dialog>` nativo.
 *
 * Escolha deliberada em vez de uma biblioteca ou de uma div com overlay:
 * o elemento nativo já entrega fechar no Esc, foco preso dentro do diálogo,
 * `aria-modal` e backdrop — tudo o que costuma ser implementado errado à mão.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // O Esc fecha o <dialog> por conta própria; precisamos avisar o React.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-border bg-bg-elevated p-0 text-fg backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      onClick={(event) => {
        // Clique no backdrop (fora do conteúdo) fecha.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h2 id="modal-title" className="text-sm font-medium text-fg">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}
