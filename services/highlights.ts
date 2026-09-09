import { db, LOCAL_USER_ID } from "@/lib/db";
import type { StoredHighlight } from "@/lib/selection";
import { err, ok, type Result } from "@/lib/result";

/**
 * Destaques (marcações) sobre a transcrição.
 *
 * O `quotedText` é gravado junto com os deslocamentos de propósito: se a faixa
 * de legenda for trocada depois, os deslocamentos podem apontar para outro
 * texto, mas o trecho que o usuário marcou continua legível — e o flashcard
 * que nascer dele continua correto.
 */

export interface CreateHighlightInput {
  videoId: string;
  startSegmentId: string;
  startOffset: number;
  endSegmentId: string;
  endOffset: number;
  quotedText: string;
  translatedText: string | null;
}

export async function createHighlight(
  input: CreateHighlightInput,
): Promise<Result<StoredHighlight>> {
  // Os dois blocos precisam pertencer ao vídeo informado; sem isso, um id
  // solto criaria uma marcação apontando para a legenda de outro vídeo.
  const segments = await db.subtitleSegment.findMany({
    where: {
      id: { in: [input.startSegmentId, input.endSegmentId] },
      track: { videoId: input.videoId, video: { userId: LOCAL_USER_ID } },
    },
    select: { id: true, index: true, text: true },
  });

  const start = segments.find((segment) => segment.id === input.startSegmentId);
  const end = segments.find((segment) => segment.id === input.endSegmentId);

  if (!start || !end) {
    return err("O trecho selecionado não pertence a este vídeo.");
  }
  if (start.index > end.index) {
    return err("A seleção começa depois de onde termina.");
  }

  const created = await db.highlight.create({
    data: {
      videoId: input.videoId,
      startSegmentId: start.id,
      startOffset: clamp(input.startOffset, 0, start.text.length),
      endSegmentId: end.id,
      endOffset: clamp(input.endOffset, 0, end.text.length),
      quotedText: input.quotedText,
      translatedText: input.translatedText,
    },
  });

  return ok({
    id: created.id,
    startSegmentId: created.startSegmentId,
    startIndex: start.index,
    startOffset: created.startOffset,
    endSegmentId: created.endSegmentId,
    endIndex: end.index,
    endOffset: created.endOffset,
    quotedText: created.quotedText,
    translatedText: created.translatedText,
  });
}

/** Destaques de um vídeo, já com os índices resolvidos para a renderização. */
export async function listHighlights(
  videoId: string,
): Promise<StoredHighlight[]> {
  const highlights = await db.highlight.findMany({
    where: { videoId, video: { userId: LOCAL_USER_ID } },
    orderBy: { createdAt: "asc" },
    include: {
      startSegment: { select: { index: true } },
      endSegment: { select: { index: true } },
    },
  });

  return highlights.map((highlight) => ({
    id: highlight.id,
    startSegmentId: highlight.startSegmentId,
    startIndex: highlight.startSegment.index,
    startOffset: highlight.startOffset,
    endSegmentId: highlight.endSegmentId,
    endIndex: highlight.endSegment.index,
    endOffset: highlight.endOffset,
    quotedText: highlight.quotedText,
    translatedText: highlight.translatedText,
  }));
}

export async function deleteHighlight(highlightId: string): Promise<boolean> {
  const result = await db.highlight.deleteMany({
    where: { id: highlightId, video: { userId: LOCAL_USER_ID } },
  });
  return result.count > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
