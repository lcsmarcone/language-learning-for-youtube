import { db, LOCAL_USER_ID } from "@/lib/db";
import type { StudySegment, TranslationStatus } from "@/lib/domain";
import type { StoredHighlight } from "@/lib/selection";
import { listHighlights } from "@/services/highlights";

/**
 * Leitura da tela de estudo: o vídeo, a faixa principal e todos os segmentos
 * com sua tradução já resolvida.
 *
 * Tudo de uma vez, de propósito. Uma legenda de uma hora tem umas 1.500 linhas
 * de texto curto — alguns poucos megabytes no pior caso — e ter a lista inteira
 * em memória é o que permite busca binária do segmento ativo, navegação entre
 * frases e seleção cruzando blocos sem ida e volta ao servidor.
 */

export interface StudyVideo {
  id: string;
  externalId: string | null;
  title: string;
  url: string;
  sourceLang: string;
  targetLang: string;
  durationSec: number | null;
  trackId: string | null;
  timingsApproximate: boolean;
  segments: StudySegment[];
  lastPositionMs: number;
  translatedCount: number;
  highlights: StoredHighlight[];
}

export async function getStudyVideo(
  videoId: string,
): Promise<StudyVideo | null> {
  const video = await db.video.findFirst({
    where: { id: videoId, userId: LOCAL_USER_ID },
    include: {
      progress: true,
      tracks: {
        where: { isPrimary: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!video) return null;

  const track = video.tracks[0] ?? null;

  const segments = track
    ? await db.subtitleSegment.findMany({
        where: { trackId: track.id },
        orderBy: { index: "asc" },
        select: {
          id: true,
          index: true,
          startMs: true,
          endMs: true,
          text: true,
          translations: {
            where: { targetLang: video.targetLang },
            select: { text: true, status: true },
            take: 1,
          },
        },
      })
    : [];

  const studySegments: StudySegment[] = segments.map((segment) => {
    const translation = segment.translations[0];
    return {
      id: segment.id,
      index: segment.index,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
      translatedText: translation?.text ?? null,
      translationStatus: (translation?.status as TranslationStatus) ?? null,
    };
  });

  const highlights = await listHighlights(video.id);

  return {
    id: video.id,
    externalId: video.externalId,
    title: video.title,
    url: video.url,
    sourceLang: video.sourceLang,
    targetLang: video.targetLang,
    durationSec: video.durationSec,
    trackId: track?.id ?? null,
    timingsApproximate: track?.timingsApproximate ?? false,
    segments: studySegments,
    lastPositionMs: video.progress?.lastPositionMs ?? 0,
    translatedCount: studySegments.filter(
      (segment) => segment.translatedText !== null,
    ).length,
    highlights,
  };
}

export interface SaveProgressInput {
  videoId: string;
  lastPositionMs: number;
  durationSec?: number | null;
}

/**
 * Grava onde o usuário parou. Chamado com debounce durante a reprodução e uma
 * última vez ao sair da página — é o que faz "fechar e reabrir e continuar
 * exatamente de onde estava" (instrucoes.md secao 23) funcionar.
 */
export async function saveProgress(input: SaveProgressInput): Promise<boolean> {
  const video = await db.video.findFirst({
    where: { id: input.videoId, userId: LOCAL_USER_ID },
    select: { id: true, durationSec: true },
  });
  if (!video) return false;

  const durationSec = input.durationSec ?? video.durationSec;
  const percentComplete =
    durationSec && durationSec > 0
      ? Math.min(1, Math.max(0, input.lastPositionMs / (durationSec * 1000)))
      : 0;

  await db.$transaction([
    db.studyProgress.upsert({
      where: { videoId: video.id },
      update: { lastPositionMs: input.lastPositionMs, percentComplete },
      create: {
        videoId: video.id,
        lastPositionMs: input.lastPositionMs,
        percentComplete,
      },
    }),
    db.video.update({
      where: { id: video.id },
      data: {
        lastStudiedAt: new Date(),
        // A duração vem do player: o oEmbed não informa esse dado.
        ...(input.durationSec && !video.durationSec
          ? { durationSec: input.durationSec }
          : {}),
      },
    }),
  ]);

  return true;
}
