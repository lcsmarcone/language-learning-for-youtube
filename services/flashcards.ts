import { db, ensureLocalUser, LOCAL_USER_ID } from "@/lib/db";
import { err, ok, type Result } from "@/lib/result";
import type { SelectionSide } from "@/lib/selection";

/**
 * Flashcards (instrucoes.md secao 7).
 *
 * Duas decisões governam este arquivo:
 *
 * 1. **A frente é sempre o idioma original e o verso sempre o português**,
 *    independentemente de qual lado o usuário selecionou. É assim que o card
 *    funciona no Anki: vê a frase em inglês, tenta lembrar o sentido.
 * 2. **O servidor deriva tudo do banco** — texto, contexto, tempos. O cliente
 *    manda apenas onde a seleção começa e termina. Assim o conteúdo do card
 *    nunca depende do que o navegador achou que estava selecionado, que foi
 *    justamente a fonte de um bug na etapa anterior.
 */

export interface CreateFlashcardInput {
  videoId: string;
  startSegmentId: string;
  startOffset: number;
  endSegmentId: string;
  endOffset: number;
  /** De que lado a seleção foi feita; o outro lado entra inteiro. */
  side: SelectionSide;
}

export interface FlashcardView {
  id: string;
  videoId: string;
  videoTitle: string;
  sourceLang: string;
  front: string;
  back: string;
  contextText: string | null;
  startMs: number;
  endMs: number;
  createdAt: string;
  exportedAt: string | null;
}

export async function createFlashcard(
  input: CreateFlashcardInput,
): Promise<Result<FlashcardView>> {
  await ensureLocalUser();

  const video = await db.video.findFirst({
    where: { id: input.videoId, userId: LOCAL_USER_ID },
    select: { id: true, title: true, sourceLang: true, targetLang: true },
  });
  if (!video) return err("Vídeo não encontrado.");

  const bounds = await db.subtitleSegment.findMany({
    where: {
      id: { in: [input.startSegmentId, input.endSegmentId] },
      track: { videoId: video.id },
    },
    select: { id: true, index: true, trackId: true },
  });

  const start = bounds.find((segment) => segment.id === input.startSegmentId);
  const end = bounds.find((segment) => segment.id === input.endSegmentId);
  if (!start || !end) {
    return err("O trecho selecionado não pertence a este vídeo.");
  }
  if (start.index > end.index) {
    return err("A seleção começa depois de onde termina.");
  }

  // Uma janela maior que a seleção: os vizinhos servem de contexto no card
  // (instrucoes.md secao 7), e é isso que faz a frase soltinha voltar a fazer
  // sentido semanas depois, no Anki.
  const window = await db.subtitleSegment.findMany({
    where: {
      trackId: start.trackId,
      index: { gte: start.index - 1, lte: end.index + 1 },
    },
    orderBy: { index: "asc" },
    select: {
      id: true,
      index: true,
      startMs: true,
      endMs: true,
      text: true,
      translations: {
        where: { targetLang: video.targetLang, status: "OK" },
        select: { text: true },
        take: 1,
      },
    },
  });

  const selected = window.filter(
    (segment) => segment.index >= start.index && segment.index <= end.index,
  );
  if (selected.length === 0) {
    return err("Não encontramos o texto desse trecho.");
  }

  const front = buildSide({
    segments: selected,
    pick: (segment) => segment.text,
    sliced: input.side === "original",
    startIndex: start.index,
    endIndex: end.index,
    startOffset: input.startOffset,
    endOffset: input.endOffset,
  });

  const back = buildSide({
    segments: selected,
    pick: (segment) => segment.translations[0]?.text ?? "",
    sliced: input.side === "translation",
    startIndex: start.index,
    endIndex: end.index,
    startOffset: input.startOffset,
    endOffset: input.endOffset,
  });

  if (front.length === 0) {
    return err("O trecho selecionado está vazio.");
  }

  const contextText = window
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const created = await db.flashcard.create({
    data: {
      userId: LOCAL_USER_ID,
      videoId: video.id,
      front,
      back,
      contextText: contextText === front ? null : contextText,
      startMs: selected[0].startMs,
      endMs: selected[selected.length - 1].endMs,
    },
  });

  return ok(toView(created, video));
}

/**
 * Monta um lado do card.
 *
 * O lado selecionado é recortado exatamente pelos deslocamentos; o outro lado
 * entra com os segmentos inteiros, porque não existe correspondência confiável
 * palavra a palavra entre os dois idiomas (instrucoes.md secao 6).
 */
function buildSide(params: {
  segments: Array<{ index: number; text: string; translations: { text: string | null }[] }>;
  pick: (segment: { text: string; translations: { text: string | null }[] }) => string;
  sliced: boolean;
  startIndex: number;
  endIndex: number;
  startOffset: number;
  endOffset: number;
}): string {
  const pieces: string[] = [];

  for (const segment of params.segments) {
    const full = params.pick(segment);
    if (!full) continue;

    if (!params.sliced) {
      pieces.push(full);
      continue;
    }

    const from = segment.index === params.startIndex ? params.startOffset : 0;
    const to =
      segment.index === params.endIndex ? params.endOffset : full.length;

    const piece = full.slice(
      Math.max(0, Math.min(full.length, from)),
      Math.max(0, Math.min(full.length, to)),
    );
    if (piece.trim().length > 0) pieces.push(piece.trim());
  }

  return pieces.join(" ").replace(/\s{2,}/g, " ").trim();
}

export interface ListFlashcardsOptions {
  videoId?: string | null;
  /** Busca simples na frente, no verso e no título do vídeo. */
  search?: string | null;
}

export async function listFlashcards(
  options: ListFlashcardsOptions = {},
): Promise<FlashcardView[]> {
  await ensureLocalUser();

  const search = options.search?.trim();

  const cards = await db.flashcard.findMany({
    where: {
      userId: LOCAL_USER_ID,
      ...(options.videoId ? { videoId: options.videoId } : {}),
      ...(search
        ? {
            OR: [
              { front: { contains: search } },
              { back: { contains: search } },
              { video: { title: { contains: search } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      video: { select: { id: true, title: true, sourceLang: true } },
    },
  });

  return cards.map((card) => toView(card, card.video));
}

export interface UpdateFlashcardInput {
  front?: string;
  back?: string;
  contextText?: string | null;
}

export async function updateFlashcard(
  id: string,
  input: UpdateFlashcardInput,
): Promise<Result<FlashcardView>> {
  const existing = await db.flashcard.findFirst({
    where: { id, userId: LOCAL_USER_ID },
    select: { id: true },
  });
  if (!existing) return err("Flashcard não encontrado.");

  const updated = await db.flashcard.update({
    where: { id },
    data: {
      ...(input.front !== undefined ? { front: input.front.trim() } : {}),
      ...(input.back !== undefined ? { back: input.back.trim() } : {}),
      ...(input.contextText !== undefined
        ? { contextText: input.contextText?.trim() || null }
        : {}),
    },
    include: { video: { select: { id: true, title: true, sourceLang: true } } },
  });

  return ok(toView(updated, updated.video));
}

export async function deleteFlashcard(id: string): Promise<boolean> {
  const result = await db.flashcard.deleteMany({
    where: { id, userId: LOCAL_USER_ID },
  });
  return result.count > 0;
}

function toView(
  card: {
    id: string;
    videoId: string;
    front: string;
    back: string;
    contextText: string | null;
    startMs: number;
    endMs: number;
    createdAt: Date;
    exportedAt: Date | null;
  },
  video: { title: string; sourceLang: string },
): FlashcardView {
  return {
    id: card.id,
    videoId: card.videoId,
    videoTitle: video.title,
    sourceLang: video.sourceLang,
    front: card.front,
    back: card.back,
    contextText: card.contextText,
    startMs: card.startMs,
    endMs: card.endMs,
    createdAt: card.createdAt.toISOString(),
    exportedAt: card.exportedAt?.toISOString() ?? null,
  };
}
