import { db, ensureLocalUser, LOCAL_USER_ID } from "@/lib/db";
import type { NormalizedSegment, SourceLanguage, SubtitleSource } from "@/lib/domain";

/**
 * Consultas da biblioteca.
 *
 * Ficam fora dos componentes de propósito: a mesma leitura serve a página e à
 * API, e o custo de cada consulta fica visível num lugar só.
 */

export interface LibraryVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  sourceLang: string;
  targetLang: string;
  createdAt: Date;
  lastStudiedAt: Date | null;
  percentComplete: number;
  flashcardCount: number;
  segmentCount: number;
  translatedCount: number;
  timingsApproximate: boolean;
}

/**
 * Lista a biblioteca com os contadores que os cards mostram.
 *
 * Os agregados são feitos em consultas próprias (`groupBy`) em vez de
 * `_count` por relação aninhada: com muitos vídeos, isso é uma consulta por
 * agregado em vez de uma por vídeo.
 */
export async function listLibrary(): Promise<LibraryVideo[]> {
  await ensureLocalUser();

  const videos = await db.video.findMany({
    where: { userId: LOCAL_USER_ID },
    orderBy: [{ lastStudiedAt: "desc" }, { createdAt: "desc" }],
    include: {
      progress: true,
      tracks: {
        where: { isPrimary: true },
        select: { id: true, timingsApproximate: true },
        take: 1,
      },
    },
  });

  if (videos.length === 0) return [];

  const videoIds = videos.map((video) => video.id);
  const trackIds = videos.flatMap((video) => video.tracks.map((t) => t.id));

  const [flashcardCounts, segmentCounts, translatedCounts] = await Promise.all([
    db.flashcard.groupBy({
      by: ["videoId"],
      where: { videoId: { in: videoIds } },
      _count: { _all: true },
    }),
    trackIds.length > 0
      ? db.subtitleSegment.groupBy({
          by: ["trackId"],
          where: { trackId: { in: trackIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    trackIds.length > 0
      ? db.translation.findMany({
          where: {
            status: "OK",
            segment: { trackId: { in: trackIds } },
          },
          select: { segment: { select: { trackId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const flashcardsByVideo = new Map(
    flashcardCounts.map((row) => [row.videoId, row._count._all]),
  );
  const segmentsByTrack = new Map(
    segmentCounts.map((row) => [row.trackId, row._count._all]),
  );
  const translatedByTrack = new Map<string, number>();
  for (const row of translatedCounts) {
    const trackId = row.segment.trackId;
    translatedByTrack.set(trackId, (translatedByTrack.get(trackId) ?? 0) + 1);
  }

  return videos.map((video) => {
    const track = video.tracks[0];
    return {
      id: video.id,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      durationSec: video.durationSec,
      sourceLang: video.sourceLang,
      targetLang: video.targetLang,
      createdAt: video.createdAt,
      lastStudiedAt: video.lastStudiedAt,
      percentComplete: video.progress?.percentComplete ?? 0,
      flashcardCount: flashcardsByVideo.get(video.id) ?? 0,
      segmentCount: track ? (segmentsByTrack.get(track.id) ?? 0) : 0,
      translatedCount: track ? (translatedByTrack.get(track.id) ?? 0) : 0,
      timingsApproximate: track?.timingsApproximate ?? false,
    };
  });
}

export interface CreateVideoWithSubtitleInput {
  externalId: string;
  url: string;
  title: string;
  thumbnailUrl: string | null;
  sourceLang: SourceLanguage;
  targetLang: string;
  subtitle: {
    segments: NormalizedSegment[];
    source: SubtitleSource;
    timingsApproximate: boolean;
    label: string | null;
  };
}

/**
 * Cria vídeo, faixa e segmentos numa transação.
 *
 * Tudo junto por um motivo prático: vídeo sem legenda é um estado que a tela
 * de estudo não tem o que fazer com. Ou entra completo, ou não entra.
 */
export async function createVideoWithSubtitle(
  input: CreateVideoWithSubtitleInput,
) {
  await ensureLocalUser();

  return db.$transaction(async (tx) => {
    const video = await tx.video.create({
      data: {
        userId: LOCAL_USER_ID,
        sourceType: "youtube",
        externalId: input.externalId,
        url: input.url,
        title: input.title,
        thumbnailUrl: input.thumbnailUrl,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
      },
    });

    const track = await tx.subtitleTrack.create({
      data: {
        videoId: video.id,
        lang: input.sourceLang,
        source: input.subtitle.source,
        label: input.subtitle.label,
        isPrimary: true,
        timingsApproximate: input.subtitle.timingsApproximate,
      },
    });

    // createMany em lotes: um insert por segmento deixaria a importação de uma
    // legenda de milhares de blocos visivelmente lenta.
    const BATCH = 500;
    for (let i = 0; i < input.subtitle.segments.length; i += BATCH) {
      const batch = input.subtitle.segments.slice(i, i + BATCH);
      await tx.subtitleSegment.createMany({
        data: batch.map((segment) => ({
          trackId: track.id,
          index: segment.index,
          startMs: segment.startMs,
          endMs: segment.endMs,
          text: segment.text,
        })),
      });
    }

    await tx.studyProgress.create({
      data: { videoId: video.id, lastPositionMs: 0, percentComplete: 0 },
    });

    return { video, track };
  });
}

/** Remove um vídeo do usuário local. Legendas, highlights e cards vão junto. */
export async function deleteVideo(videoId: string): Promise<boolean> {
  const result = await db.video.deleteMany({
    where: { id: videoId, userId: LOCAL_USER_ID },
  });
  return result.count > 0;
}
