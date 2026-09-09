/**
 * Cópia para a área de transferência.
 *
 * É a operação mais importante do produto depois de assistir: o fluxo para o
 * Anki é "clico em copiar, colo no Anki" (instrucoes.md secao 7), e ele precisa
 * funcionar na primeira tentativa, sempre.
 *
 * Por isso existe o caminho alternativo: a API moderna exige contexto seguro
 * (https ou localhost) e pode ser bloqueada por permissão. Quando ela falha,
 * caímos no truque antigo do `<textarea>` invisível, que funciona em qualquer
 * navegador.
 */
export async function copyText(text: string): Promise<boolean> {
  if (text.length === 0) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cai para o método antigo abaixo.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Fora da tela, mas ainda selecionável — requisito do execCommand.
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

/**
 * Formato "Frente[TAB]Verso", que o Anki entende na importação
 * (instrucoes.md secao 7).
 *
 * Tabulação e quebra de linha dentro do texto viram espaço: elas separariam
 * campos e linhas na importação, e um único caractere fora do lugar
 * desalinharia o arquivo inteiro.
 */
export function frontBackLine(front: string, back: string): string {
  return `${sanitizeField(front)}\t${sanitizeField(back)}`;
}

export function sanitizeField(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
