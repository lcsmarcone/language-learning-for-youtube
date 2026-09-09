import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { db, ensureLocalUser, LOCAL_USER_ID } from "@/lib/db";

/**
 * Teste de fumaça do banco: confirma que o schema aplicado suporta o fluxo
 * mínimo do produto — vídeo com faixa, segmentos ordenados, traduções, highlight
 * e flashcard — e que o cascade de exclusão realmente limpa tudo.
 *
 * Roda contra o banco de desenvolvimento e cria dados sob um vídeo próprio,
 * removido ao final. Não depende do seed.
 */

const TEST_EXTERNAL_ID = "test_vid_db";

afterAll(async () => {
  await db.video
    .deleteMany({
      where: { externalId: TEST_EXTERNAL_ID },
    })
    .catch(() => undefined);
  await db.$disconnect();
});

describe("modelo de dados", () => {
  it("persiste o fluxo vídeo → legenda → tradução → highlight → flashcard", async () => {
    await ensureLocalUser();

    // Estado limpo, mesmo que uma execução anterior tenha falhado no meio.
    await db.video.deleteMany({ where: { externalId: TEST_EXTERNAL_ID } });

    const video = await db.video.create({
      data: {
        userId: LOCAL_USER_ID,
        sourceType: "youtube",
        externalId: TEST_EXTERNAL_ID,
        url: `https://www.youtube.com/watch?v=${TEST_EXTERNAL_ID}`,
        title: "Vídeo de teste",
        sourceLang: "en",
        targetLang: "pt-BR",
      },
    });

    const track = await db.subtitleTrack.create({
      data: { videoId: video.id, lang: "en", source: "srt" },
    });

    // Inseridos fora de ordem de propósito: a leitura precisa ordenar por index.
    await db.subtitleSegment.createMany({
      data: [
        { trackId: track.id, index: 1, startMs: 2000, endMs: 4000, text: "Second." },
        { trackId: track.id, index: 0, startMs: 0, endMs: 2000, text: "First." },
      ],
    });

    const segments = await db.subtitleSegment.findMany({
      where: { trackId: track.id },
      orderBy: { index: "asc" },
    });
    expect(segments.map((s) => s.text)).toEqual(["First.", "Second."]);

    await db.translation.create({
      data: {
        segmentId: segments[0].id,
        targetLang: "pt-BR",
        text: "Primeiro.",
        provider: "test",
        status: "OK",
      },
    });

    const highlight = await db.highlight.create({
      data: {
        videoId: video.id,
        startSegmentId: segments[0].id,
        startOffset: 0,
        endSegmentId: segments[0].id,
        endOffset: 5,
        quotedText: "First",
        translatedText: "Primeiro.",
      },
    });

    const flashcard = await db.flashcard.create({
      data: {
        userId: LOCAL_USER_ID,
        videoId: video.id,
        highlightId: highlight.id,
        front: "First",
        back: "Primeiro.",
        contextText: "First. Second.",
        startMs: 0,
        endMs: 2000,
      },
    });

    expect(flashcard.tags).toBe("[]");

    await db.studyProgress.create({
      data: { videoId: video.id, lastPositionMs: 1500, percentComplete: 0.5 },
    });

    const reloaded = await db.video.findUniqueOrThrow({
      where: { id: video.id },
      include: {
        progress: true,
        tracks: { include: { segments: { include: { translations: true } } } },
        flashcards: true,
      },
    });

    expect(reloaded.progress?.lastPositionMs).toBe(1500);
    expect(reloaded.tracks[0].segments).toHaveLength(2);
    expect(reloaded.flashcards).toHaveLength(1);
    expect(
      reloaded.tracks[0].segments.flatMap((s) => s.translations)[0].text,
    ).toBe("Primeiro.");
  });

  it("impede o mesmo vídeo duplicado na biblioteca", async () => {
    await expect(
      db.video.create({
        data: {
          userId: LOCAL_USER_ID,
          sourceType: "youtube",
          externalId: TEST_EXTERNAL_ID,
          url: "https://www.youtube.com/watch?v=test_vid_db",
          title: "Duplicado",
          sourceLang: "en",
        },
      }),
    ).rejects.toThrow();
  });

  it("apaga legendas, highlights e flashcards junto com o vídeo", async () => {
    await db.video.deleteMany({ where: { externalId: TEST_EXTERNAL_ID } });

    expect(await db.subtitleTrack.count({ where: { video: { externalId: TEST_EXTERNAL_ID } } })).toBe(0);
    expect(await db.flashcard.count({ where: { video: { externalId: TEST_EXTERNAL_ID } } })).toBe(0);
  });
});
