/**
 * Atalhos de teclado da tela de estudo (instrucoes.md secao 14).
 *
 * A lista abaixo é a fonte única: ela governa o que o teclado faz **e** o que
 * o modal de ajuda mostra. Documentação que vive longe do código envelhece;
 * esta não tem como.
 *
 * Critério das teclas escolhidas: nada que o navegador já use (Ctrl+alguma
 * coisa, F5, Tab), nada que atrapalhe digitar, e as ações mais repetidas na
 * mão esquerda, perto do descanso — quem estuda fica com a direita no mouse.
 */

export type ShortcutAction =
  | "togglePlay"
  | "back"
  | "forward"
  | "previousSegment"
  | "nextSegment"
  | "repeatSegment"
  | "markAb"
  | "createFlashcard"
  | "cancel"
  | "help";

export interface ShortcutDefinition {
  action: ShortcutAction;
  /** Como a tecla aparece na ajuda. */
  keys: string;
  description: string;
}

export const SHORTCUTS: ShortcutDefinition[] = [
  { action: "togglePlay", keys: "Espaço", description: "Reproduzir ou pausar" },
  { action: "back", keys: "←", description: "Voltar 5 segundos" },
  { action: "forward", keys: "→", description: "Avançar 5 segundos" },
  { action: "previousSegment", keys: "↑", description: "Frase anterior" },
  { action: "nextSegment", keys: "↓", description: "Próxima frase" },
  { action: "repeatSegment", keys: "R", description: "Repetir a frase atual em loop" },
  { action: "markAb", keys: "A", description: "Marcar início e fim de um trecho para repetir" },
  { action: "createFlashcard", keys: "F", description: "Criar flashcard da seleção ou da frase atual" },
  { action: "cancel", keys: "Esc", description: "Cancelar seleção ou parar a repetição" },
  { action: "help", keys: "?", description: "Mostrar esta lista" },
];

/**
 * Descobre qual ação uma tecla dispara.
 *
 * Devolve `null` quando a combinação tem modificador: `Ctrl+R` é recarregar a
 * página, e roubar isso do usuário seria hostil.
 */
export function matchShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): ShortcutAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  switch (event.key) {
    case " ":
      return "togglePlay";
    case "ArrowLeft":
      return "back";
    case "ArrowRight":
      return "forward";
    case "ArrowUp":
      return "previousSegment";
    case "ArrowDown":
      return "nextSegment";
    case "r":
    case "R":
      return "repeatSegment";
    case "a":
    case "A":
      return "markAb";
    case "f":
    case "F":
      return "createFlashcard";
    case "Escape":
      return "cancel";
    case "?":
      return "help";
    default:
      return null;
  }
}

/**
 * Diz se o atalho deve ser ignorado por causa de onde o foco está.
 *
 * Sem isso, digitar "for" numa caixa de busca criaria um flashcard e daria
 * play no vídeo. Campos de texto, áreas editáveis e o próprio diálogo aberto
 * têm prioridade sobre qualquer atalho.
 */
export function shouldIgnoreShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;

  // Dentro de um diálogo aberto, o teclado pertence ao diálogo.
  if (target.closest("dialog[open]")) return true;

  return false;
}
