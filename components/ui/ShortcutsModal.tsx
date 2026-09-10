"use client";

import { Modal } from "./Modal";
import { SHORTCUTS } from "@/lib/shortcuts";

/**
 * Lista de atalhos (instrucoes.md secao 14 — "inclua uma pequena tela/modal
 * mostrando os atalhos").
 *
 * O conteúdo vem da mesma constante que o teclado usa, então não existe a
 * chance de a ajuda descrever um atalho que não funciona mais.
 */
export function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Atalhos de teclado"
      description="Funcionam na tela de estudo, quando o foco não está em um campo de texto."
    >
      <dl className="flex flex-col gap-1">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.action}
            className="flex items-center gap-4 rounded px-2 py-1.5 odd:bg-bg-subtle"
          >
            <dt className="w-16 shrink-0">
              <kbd className="inline-flex min-w-7 justify-center rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[11px] text-fg">
                {shortcut.keys}
              </kbd>
            </dt>
            <dd className="text-xs text-fg-muted">{shortcut.description}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
