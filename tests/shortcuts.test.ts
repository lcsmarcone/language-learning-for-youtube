// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { matchShortcut, shouldIgnoreShortcut, SHORTCUTS } from "@/lib/shortcuts";

function press(key: string, modifiers: Partial<Record<"ctrlKey" | "metaKey" | "altKey", boolean>> = {}) {
  return matchShortcut({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...modifiers,
  });
}

describe("matchShortcut", () => {
  it("reconhece as teclas da tela de estudo", () => {
    expect(press(" ")).toBe("togglePlay");
    expect(press("ArrowLeft")).toBe("back");
    expect(press("ArrowRight")).toBe("forward");
    expect(press("ArrowUp")).toBe("previousSegment");
    expect(press("ArrowDown")).toBe("nextSegment");
    expect(press("r")).toBe("repeatSegment");
    expect(press("a")).toBe("markAb");
    expect(press("f")).toBe("createFlashcard");
    expect(press("Escape")).toBe("cancel");
    expect(press("?")).toBe("help");
  });

  it("aceita maiúsculas (Caps Lock ligado, ou Shift)", () => {
    expect(press("R")).toBe("repeatSegment");
    expect(press("F")).toBe("createFlashcard");
    expect(press("A")).toBe("markAb");
  });

  it("não rouba combinações do navegador", () => {
    // Ctrl+R é recarregar; Cmd+F é buscar na página.
    expect(press("r", { ctrlKey: true })).toBeNull();
    expect(press("f", { metaKey: true })).toBeNull();
    expect(press("ArrowLeft", { altKey: true })).toBeNull();
  });

  it("ignora teclas sem atalho", () => {
    expect(press("z")).toBeNull();
    expect(press("Enter")).toBeNull();
  });
});

describe("shouldIgnoreShortcut", () => {
  it("ignora atalhos enquanto se digita", () => {
    // Digitar "for" numa busca não pode criar flashcard e dar play.
    for (const tag of ["input", "textarea", "select"]) {
      const element = document.createElement(tag);
      expect(shouldIgnoreShortcut(element), tag).toBe(true);
    }
  });

  it("ignora atalhos em área editável", () => {
    const element = document.createElement("div");
    element.contentEditable = "true";
    // jsdom não deriva isContentEditable do atributo; forçamos a propriedade.
    Object.defineProperty(element, "isContentEditable", { value: true });
    expect(shouldIgnoreShortcut(element)).toBe(true);
  });

  it("ignora atalhos dentro de um diálogo aberto", () => {
    document.body.innerHTML = `<dialog open><button id="dentro">ok</button></dialog>`;
    expect(shouldIgnoreShortcut(document.getElementById("dentro"))).toBe(true);
  });

  it("permite atalhos no resto da tela", () => {
    document.body.innerHTML = `<div id="fora">transcrição</div>`;
    expect(shouldIgnoreShortcut(document.getElementById("fora"))).toBe(false);
    expect(shouldIgnoreShortcut(null)).toBe(false);
  });
});

describe("lista de atalhos", () => {
  it("descreve toda ação que o teclado dispara", () => {
    // A ajuda e o teclado vêm da mesma fonte: nenhuma ação pode ficar sem
    // descrição, nem sobrar descrição de atalho que não existe.
    const acoes = SHORTCUTS.map((shortcut) => shortcut.action);
    expect(new Set(acoes).size).toBe(acoes.length);

    for (const shortcut of SHORTCUTS) {
      expect(shortcut.keys.length).toBeGreaterThan(0);
      expect(shortcut.description.length).toBeGreaterThan(0);
    }
  });
});
