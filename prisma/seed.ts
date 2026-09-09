import "dotenv/config";
import { db, ensureLocalUser, LOCAL_USER_ID } from "../lib/db";

/**
 * Seed de desenvolvimento.
 *
 * Serve para poder abrir a tela de estudo antes de a importação de legendas
 * existir, e para os testes de fumaça terem dados reais. É idempotente: rodar
 * duas vezes não duplica nada.
 *
 * Vídeo usado: "Me at the zoo" (jawed) — o primeiro vídeo do YouTube, público,
 * com 19 segundos. Curto de propósito: dá para conferir a sincronia inteira.
 */

const SEED_VIDEO_EXTERNAL_ID = "jNQXAC9IVRw";

const SEGMENTS: Array<{ startMs: number; endMs: number; text: string }> = [
  { startMs: 0, endMs: 2200, text: "All right, so here we are." },
  { startMs: 2200, endMs: 4600, text: "In front of the elephants." },
  {
    startMs: 4600,
    endMs: 8000,
    text: "The cool thing about these guys is that they have really,",
  },
  { startMs: 8000, endMs: 9800, text: "really, really long trunks." },
  { startMs: 9800, endMs: 11600, text: "And that's cool." },
  { startMs: 11600, endMs: 14200, text: "And that's pretty much all there is to say." },
  { startMs: 14200, endMs: 16000, text: "I have been studying English for three years." },
  { startMs: 16000, endMs: 17600, text: "I didn't know what to expect." },
  { startMs: 17600, endMs: 18600, text: "But it was worth it." },
  { startMs: 18600, endMs: 19500, text: "See you next time." },
];

const TRANSLATIONS: Record<number, string> = {
  0: "Muito bem, então aqui estamos nós.",
  1: "Na frente dos elefantes.",
  2: "O legal desses caras é que eles têm trombas",
  3: "muito, muito, muito compridas.",
  4: "E isso é legal.",
  5: "E é basicamente isso que dá para dizer.",
  6: "Eu estudo inglês há três anos.",
  7: "Eu não sabia o que esperar.",
  8: "Mas valeu a pena.",
  9: "Até a próxima.",
};

async function main() {
  await ensureLocalUser();

  const video = await db.video.upsert({
    where: {
      userId_sourceType_externalId: {
        userId: LOCAL_USER_ID,
        sourceType: "youtube",
        externalId: SEED_VIDEO_EXTERNAL_ID,
      },
    },
    update: {},
    create: {
      userId: LOCAL_USER_ID,
      sourceType: "youtube",
      externalId: SEED_VIDEO_EXTERNAL_ID,
      url: `https://www.youtube.com/watch?v=${SEED_VIDEO_EXTERNAL_ID}`,
      title: "Me at the zoo (exemplo)",
      thumbnailUrl: `https://i.ytimg.com/vi/${SEED_VIDEO_EXTERNAL_ID}/hqdefault.jpg`,
      durationSec: 19,
      sourceLang: "en",
      targetLang: "pt-BR",
    },
  });

  // A faixa é recriada do zero para o seed ser previsível mesmo depois de
  // alterações manuais durante o desenvolvimento.
  await db.subtitleTrack.deleteMany({ where: { videoId: video.id } });

  const track = await db.subtitleTrack.create({
    data: {
      videoId: video.id,
      lang: "en",
      source: "srt",
      label: "Legenda de exemplo",
      isPrimary: true,
    },
  });

  for (const [index, segment] of SEGMENTS.entries()) {
    const created = await db.subtitleSegment.create({
      data: {
        trackId: track.id,
        index,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
      },
    });

    const translated = TRANSLATIONS[index];
    if (translated) {
      await db.translation.create({
        data: {
          segmentId: created.id,
          targetLang: "pt-BR",
          text: translated,
          status: "OK",
          provider: "seed",
        },
      });
    }
  }

  await db.studyProgress.upsert({
    where: { videoId: video.id },
    update: {},
    create: { videoId: video.id, lastPositionMs: 0, percentComplete: 0 },
  });

  const segmentCount = await db.subtitleSegment.count({
    where: { trackId: track.id },
  });

  console.log(
    `Seed concluído: vídeo "${video.title}" com ${segmentCount} segmentos e traduções.`,
  );
}

main()
  .catch((error) => {
    console.error("Falha no seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
