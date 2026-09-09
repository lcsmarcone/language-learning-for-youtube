import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, ensureLocalUser, LOCAL_USER_ID } from "@/lib/db";
import {
  createFlashcard,
  deleteFlashcard,
  listFlashcards,
  updateFlashcard,
} from "@/services/flashcards";
import { frontBackLine, sanitizeField } from "@/lib/clipboard";

const EXTERNAL_ID = "test_cards";

let videoId = "";
const segmentIds: string[] = [];

const SEGMENTS = [
  { text: "I've recently moved to London.", pt: "Eu me mudei para Londres há pouco tempo." },
  { text: "I have been studying English for three years.", pt: "Eu estudo inglês há três anos." },
  { text: "But I still get nervous when I speak.", pt: "Mas ainda fico nervoso quando falo." },
];

beforeAll(async () => {
  await ensureLocalUser();
  await db.video.deleteMany({ where: { externalId: EXTERNAL_ID } });

  const video = await db.video.create({
    data: {
      userId: LOCAL_USER_ID,
      sourceType: "youtube",
      externalId: EXTERNAL_ID,
      url: "https://www.youtube.com/watch?v=test_cards",
      title: "Vídeo de teste",
      sourceLang: "en",
      targetLang: "pt-BR",
    },
  });
  videoId = video.id;

  const track = await db.subtitleTrack.create({
    data: { videoId: video.id, lang: "en", source: "srt" },
  });

  for (const [index, segment] of SEGMENTS.entries()) {
    const created = await db.subtitleSegment.create({
      data: {
        trackId: track.id,
        index,
        startMs: index * 3000,
        endMs: (index + 1) * 3000,
        text: segment.text,
      },
    });
    segmentIds.push(created.id);

    await db.translation.create({
      data: {
        segmentId: created.id,
        targetLang: "pt-BR",
        text: segment.pt,
        status: "OK",
        provider: "teste",
      },
    });
  }
});

afterAll(async () => {
  await db.video.deleteMany({ where: { externalId: EXTERNAL_ID } });
  await db.$disconnect();
});

function expectOk<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`Esperava sucesso, veio: ${result.reason}`);
  return result.value;
}

describe("createFlashcard", () => {
  it("cria um card da frase inteira, com contexto e tempos", async () => {
    const card = expectOk(
      await createFlashcard({
        videoId,
        startSegmentId: segmentIds[1],
        startOffset: 0,
        endSegmentId: segmentIds[1],
        endOffset: SEGMENTS[1].text.length,
        side: "original",
      }),
    );

    expect(card.front).toBe("I have been studying English for three years.");
    expect(card.back).toBe("Eu estudo inglês há três anos.");
    expect(card.startMs).toBe(3000);
    expect(card.endMs).toBe(6000);
    // O contexto traz a frase anterior e a seguinte, como pede a secao 7.
    expect(card.contextText).toContain("recently moved to London");
    expect(card.contextText).toContain("still get nervous");
  });

  it("recorta só o trecho selecionado na frente, mas traz a tradução inteira", async () => {
    const card = expectOk(
      await createFlashcard({
        videoId,
        startSegmentId: segmentIds[1],
        startOffset: 7,
        endOffset: 28,
        endSegmentId: segmentIds[1],
        side: "original",
      }),
    );

    expect(card.front).toBe("been studying English");
    // Não existe alinhamento palavra a palavra: o verso vem inteiro.
    expect(card.back).toBe("Eu estudo inglês há três anos.");
  });

  it("inverte os lados quando a seleção é feita no português", async () => {
    const card = expectOk(
      await createFlashcard({
        videoId,
        startSegmentId: segmentIds[1],
        startOffset: 0,
        endOffset: 16,
        endSegmentId: segmentIds[1],
        side: "translation",
      }),
    );

    // A frente continua sendo o idioma original, sempre — é assim que o card
    // funciona no Anki.
    expect(card.front).toBe("I have been studying English for three years.");
    expect(card.back).toBe("Eu estudo inglês");
  });

  it("junta blocos numa seleção que atravessa frases", async () => {
    const card = expectOk(
      await createFlashcard({
        videoId,
        startSegmentId: segmentIds[0],
        startOffset: 14,
        endSegmentId: segmentIds[1],
        endOffset: 21,
        side: "original",
      }),
    );

    expect(card.front).toBe("moved to London. I have been studying");
    expect(card.back).toBe(
      "Eu me mudei para Londres há pouco tempo. Eu estudo inglês há três anos.",
    );
    expect(card.startMs).toBe(0);
    expect(card.endMs).toBe(6000);
  });

  it("recusa trecho de outro vídeo", async () => {
    const result = await createFlashcard({
      videoId,
      startSegmentId: "id-que-nao-existe",
      startOffset: 0,
      endSegmentId: segmentIds[0],
      endOffset: 5,
      side: "original",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/não pertence/i);
  });

  it("recusa seleção vazia", async () => {
    const result = await createFlashcard({
      videoId,
      startSegmentId: segmentIds[0],
      startOffset: 5,
      endSegmentId: segmentIds[0],
      endOffset: 5,
      side: "original",
    });

    expect(result.ok).toBe(false);
  });
});

describe("listar, editar e excluir", () => {
  it("lista os cards do vídeo e permite buscar", async () => {
    const todos = await listFlashcards({ videoId });
    expect(todos.length).toBeGreaterThan(0);

    const busca = await listFlashcards({ videoId, search: "nervoso" });
    expect(busca.every((card) => card.back.includes("nervoso") || card.front.includes("nervoso"))).toBe(true);
  });

  it("edita a frente e o verso", async () => {
    const [card] = await listFlashcards({ videoId });

    const updated = expectOk(
      await updateFlashcard(card.id, { front: "Editado", back: "Traduzido" }),
    );

    expect(updated.front).toBe("Editado");
    expect(updated.back).toBe("Traduzido");
  });

  it("exclui e some da lista", async () => {
    const [card] = await listFlashcards({ videoId });
    const antes = (await listFlashcards({ videoId })).length;

    expect(await deleteFlashcard(card.id)).toBe(true);
    expect((await listFlashcards({ videoId })).length).toBe(antes - 1);
  });

  it("excluir algo que não existe devolve false", async () => {
    expect(await deleteFlashcard("nao-existe")).toBe(false);
  });
});

describe("formato de cópia para o Anki", () => {
  it("separa frente e verso por tabulação", () => {
    expect(frontBackLine("Hello", "Olá")).toBe("Hello\tOlá");
  });

  it("remove tabulação e quebra de linha de dentro do texto", () => {
    // Um TAB perdido no meio do texto criaria uma coluna a mais na importação
    // e desalinharia o arquivo inteiro.
    expect(frontBackLine("a\tb", "c\nd")).toBe("a b\tc d");
    expect(sanitizeField("linha um\r\nlinha dois")).toBe("linha um linha dois");
  });

  it("colapsa espaços repetidos", () => {
    expect(sanitizeField("muito    espaço")).toBe("muito espaço");
  });
});
