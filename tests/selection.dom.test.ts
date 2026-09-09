// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readSelection, textOffsetWithin } from "@/lib/selection";

/**
 * Estes testes montam o mesmo DOM que `SegmentRow` produz e leem seleções de
 * verdade. É o único jeito de provar que a conversão Range → objeto salvo
 * funciona — inclusive quando a seleção cruza blocos, quando é feita de trás
 * para frente, e quando o texto já está partido por destaques anteriores.
 */

const segments = [
  { id: "s0", index: 0, text: "All right, so here we are." },
  { id: "s1", index: 1, text: "In front of the elephants." },
  { id: "s2", index: 2, text: "And that's cool." },
];

const translations: Record<string, string> = {
  s0: "Muito bem, então aqui estamos nós.",
  s1: "Na frente dos elefantes.",
  s2: "E isso é legal.",
};

const segmentsById = new Map(
  segments.map((segment) => [
    segment.id,
    {
      index: segment.index,
      text: segment.text,
      translatedText: translations[segment.id],
    },
  ]),
);

function render(options: { splitFirst?: boolean } = {}) {
  document.body.innerHTML = segments
    .map((segment) => {
      // `splitFirst` simula um bloco que já tem destaque salvo: o texto vira
      // vários nós, com um <mark> no meio.
      const original =
        options.splitFirst && segment.id === "s0"
          ? `<mark>All right</mark>, so here we are.`
          : segment.text;

      return `
        <div data-segment-id="${segment.id}" data-segment-index="${segment.index}">
          <p data-role="original">${original}</p>
          <p data-role="translation">${translations[segment.id]}</p>
        </div>`;
    })
    .join("");
}

/** Pega o nó de texto de índice `n` dentro de um elemento. */
function textNodes(element: Element): Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

function sideElement(segmentId: string, side: "original" | "translation") {
  return document.querySelector(
    `[data-segment-id="${segmentId}"] [data-role="${side}"]`,
  ) as HTMLElement;
}

function select(range: Range) {
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

beforeEach(() => {
  render();
});

describe("textOffsetWithin", () => {
  it("conta o deslocamento com o texto num nó só", () => {
    const p = sideElement("s0", "original");
    const node = textNodes(p)[0];
    expect(textOffsetWithin(p, node, 4)).toBe(4);
  });

  it("conta o deslocamento com o texto partido por um destaque", () => {
    render({ splitFirst: true });
    const p = sideElement("s0", "original");
    const nodes = textNodes(p);

    // nodes[0] = "All right" (dentro do <mark>), nodes[1] = ", so here we are."
    expect(textOffsetWithin(p, nodes[0], 0)).toBe(0);
    expect(textOffsetWithin(p, nodes[1], 0)).toBe(9);
    expect(textOffsetWithin(p, nodes[1], 2)).toBe(11);
  });
});

describe("readSelection", () => {
  it("devolve null quando não há seleção", () => {
    window.getSelection()?.removeAllRanges();
    expect(readSelection(segmentsById)).toBeNull();
  });

  it("lê uma seleção dentro de um bloco, no original", () => {
    const p = sideElement("s0", "original");
    const node = textNodes(p)[0];

    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 9);
    select(range);

    const snapshot = readSelection(segmentsById)!;

    expect(snapshot).not.toBeNull();
    expect(snapshot.side).toBe("original");
    expect(snapshot.startSegmentId).toBe("s0");
    expect(snapshot.endSegmentId).toBe("s0");
    expect(snapshot.startOffset).toBe(0);
    expect(snapshot.endOffset).toBe(9);
    expect(snapshot.quotedText).toBe("All right");
    expect(snapshot.segmentIds).toEqual(["s0"]);
  });

  it("reconstrói exatamente o texto selecionado a partir dos deslocamentos", () => {
    const p = sideElement("s1", "original");
    const node = textNodes(p)[0];

    const range = document.createRange();
    range.setStart(node, 9);
    range.setEnd(node, 25);
    select(range);

    const snapshot = readSelection(segmentsById)!;

    // O round-trip que interessa: com os deslocamentos salvos, o trecho é
    // recuperável a partir do texto do banco, sem depender do DOM.
    const recovered = segments[1].text.slice(
      snapshot.startOffset,
      snapshot.endOffset,
    );
    expect(recovered).toBe(snapshot.quotedText);
    expect(recovered).toBe("of the elephants");
  });

  it("não deixa a tradução do meio entrar no texto selecionado", () => {
    // Original e tradução são vizinhos no DOM, então uma seleção que vai de um
    // bloco ao seguinte arrasta o português do primeiro no caminho. O texto
    // salvo tem que vir dos dados, não do que o navegador devolve.
    const first = textNodes(sideElement("s0", "original"))[0];
    const second = textNodes(sideElement("s1", "original"))[0];

    const range = document.createRange();
    range.setStart(first, 11);
    range.setEnd(second, 8);
    select(range);

    const doNavegador = window.getSelection()!.toString();
    const snapshot = readSelection(segmentsById)!;

    expect(doNavegador).toContain("Muito bem");
    expect(snapshot.quotedText).not.toContain("Muito bem");
    expect(snapshot.quotedText).toBe("so here we are. In front");
  });

  it("monta o texto do lado da tradução quando a seleção é em português", () => {
    const a = textNodes(sideElement("s0", "translation"))[0];
    const b = textNodes(sideElement("s1", "translation"))[0];

    const range = document.createRange();
    range.setStart(a, 11);
    range.setEnd(b, 9);
    select(range);

    const snapshot = readSelection(segmentsById)!;

    expect(snapshot.side).toBe("translation");
    expect(snapshot.quotedText).toBe("então aqui estamos nós. Na frente");
    expect(snapshot.quotedText).not.toContain("All right");
  });

  it("lê uma seleção que cruza blocos adjacentes", () => {
    const first = textNodes(sideElement("s0", "original"))[0];
    const last = textNodes(sideElement("s2", "original"))[0];

    const range = document.createRange();
    range.setStart(first, 11);
    range.setEnd(last, 8);
    select(range);

    const snapshot = readSelection(segmentsById)!;

    expect(snapshot.startSegmentId).toBe("s0");
    expect(snapshot.startOffset).toBe(11);
    expect(snapshot.endSegmentId).toBe("s2");
    expect(snapshot.endOffset).toBe(8);
    // Todos os blocos tocados entram, inclusive o do meio.
    expect(snapshot.segmentIds).toEqual(["s0", "s1", "s2"]);
  });

  it("normaliza a seleção arrastada da direita para a esquerda", () => {
    const p = sideElement("s0", "original");
    const node = textNodes(p)[0];

    // Âncora depois do foco: é o que o navegador monta quando se arrasta de
    // trás para frente.
    window.getSelection()!.setBaseAndExtent(node, 9, node, 0);

    const snapshot = readSelection(segmentsById)!;

    expect(snapshot.startOffset).toBe(0);
    expect(snapshot.endOffset).toBe(9);
    expect(snapshot.quotedText).toBe("All right");
  });

  it("lê seleção do lado da tradução e marca o lado corretamente", () => {
    const p = sideElement("s0", "translation");
    const node = textNodes(p)[0];

    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 10);
    select(range);

    const snapshot = readSelection(segmentsById)!;

    expect(snapshot.side).toBe("translation");
    expect(snapshot.startSegmentId).toBe("s0");
  });

  it("ignora seleção que mistura original e tradução", () => {
    const original = textNodes(sideElement("s0", "original"))[0];
    const translation = textNodes(sideElement("s0", "translation"))[0];

    const range = document.createRange();
    range.setStart(original, 0);
    range.setEnd(translation, 5);
    select(range);

    // Misturar os dois idiomas não produz um trecho com sentido: melhor
    // ignorar do que salvar algo estranho.
    expect(readSelection(segmentsById)).toBeNull();
  });

  it("ignora seleção fora da transcrição", () => {
    document.body.insertAdjacentHTML("beforeend", "<p id=fora>texto solto</p>");
    const node = textNodes(document.getElementById("fora")!)[0];

    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 5);
    select(range);

    expect(readSelection(segmentsById)).toBeNull();
  });

  it("lê a seleção certa mesmo com o texto partido por um destaque anterior", () => {
    render({ splitFirst: true });

    const p = sideElement("s0", "original");
    const nodes = textNodes(p);

    // Seleciona ", so here" — que começa no segundo nó de texto.
    const range = document.createRange();
    range.setStart(nodes[1], 0);
    range.setEnd(nodes[1], 9);
    select(range);

    const snapshot = readSelection(segmentsById)!;

    expect(snapshot.startOffset).toBe(9);
    expect(snapshot.endOffset).toBe(18);
    expect(
      segments[0].text.slice(snapshot.startOffset, snapshot.endOffset),
    ).toBe(", so here");
  });
});
