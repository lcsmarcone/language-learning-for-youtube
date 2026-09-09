import { db } from "@/lib/db";
import type { SourceLanguage } from "@/lib/domain";
import { lookupCached, storeCached } from "./cache";
import { buildChunks } from "./chunk";
import { getTranslationProvider } from "./index";
import { TranslationError, type TranslationProvider } from "./types";

/**
 * Execução da tradução de uma faixa inteira.
 *
 * Roda em segundo plano: a rota responde na hora e o trabalho continua, com o
 * progresso gravado no banco para a tela poder acompanhar. Traduzir uma legenda
 * de uma hora são dezenas de chamadas — segurar a requisição HTTP durante tudo
 * isso daria timeout e deixaria o usuário olhando para uma tela travada.
 *
 * O que este módulo garante:
 *
 * - **nada é traduzido duas vezes** — segmentos já traduzidos são pulados e o
 *   cache é consultado antes de qualquer chamada paga;
 * - **falha é parcial, não total** — um bloco que falha vira `FAILED` e os
 *   outros continuam, porque tradução parcial é útil e tela vazia não é;
 * - **um trabalho por faixa** — dois disparos simultâneos não duplicam custo.
 */

/** Tentativas por bloco antes de desistir dele. */
const MAX_ATTEMPTS = 3;

/** Espera entre tentativas, crescente. */
const RETRY_DELAY_MS = [1000, 4000];

/** Faixas com tradução em andamento neste processo. */
const running = new Set<string>();

export interface StartTranslationResult {
  jobId: string;
  total: number;
  alreadyTranslated: number;
}

export class TranslationJobError extends Error {}

/**
 * Prepara e dispara a tradução. Retorna assim que o trabalho começa.
 */
export async function startTranslationJob(
  trackId: string,
): Promise<StartTranslationResult> {
  if (running.has(trackId)) {
    throw new TranslationJobError(
      "A tradução desta legenda já está em andamento.",
    );
  }

  const track = await db.subtitleTrack.findUnique({
    where: { id: trackId },
    include: { video: { select: { id: true, title: true, targetLang: true } } },
  });

  if (!track) {
    throw new TranslationJobError("Legenda não encontrada.");
  }

  const targetLang = track.video.targetLang;

  const segments = await db.subtitleSegment.findMany({
    where: { trackId },
    orderBy: { index: "asc" },
    select: {
      id: true,
      index: true,
      text: true,
      translations: {
        where: { targetLang },
        select: { id: true, status: true },
        take: 1,
      },
    },
  });

  if (segments.length === 0) {
    throw new TranslationJobError("Esta legenda não tem nenhum bloco de texto.");
  }

  // Já traduzido com sucesso fica de fora; o que falhou antes entra de novo,
  // que é o que faz o botão "tentar novamente" funcionar.
  const pending = segments.filter((segment) => {
    const existing = segment.translations[0];
    return !existing || existing.status === "FAILED";
  });

  const alreadyTranslated = segments.length - pending.length;

  // Provedor resolvido antes de criar o trabalho: se falta a chave, o usuário
  // recebe a mensagem na hora, em vez de ver um trabalho que falha sozinho.
  const provider = getTranslationProvider();

  const job = await db.translationJob.create({
    data: {
      trackId,
      targetLang,
      status: pending.length === 0 ? "DONE" : "RUNNING",
      total: pending.length,
      done: 0,
      failed: 0,
      finishedAt: pending.length === 0 ? new Date() : null,
    },
  });

  if (pending.length === 0) {
    return { jobId: job.id, total: 0, alreadyTranslated };
  }

  running.add(trackId);

  // Deliberadamente sem `await`: o trabalho continua depois da resposta HTTP.
  void runJob({
    jobId: job.id,
    trackId,
    provider,
    sourceLang: track.lang as SourceLanguage,
    targetLang,
    videoTitle: track.video.title,
    segments,
    pending,
  }).finally(() => running.delete(trackId));

  return { jobId: job.id, total: pending.length, alreadyTranslated };
}

interface SegmentRow {
  id: string;
  index: number;
  text: string;
}

async function runJob(params: {
  jobId: string;
  trackId: string;
  provider: TranslationProvider;
  sourceLang: SourceLanguage;
  targetLang: string;
  videoTitle: string;
  segments: SegmentRow[];
  pending: SegmentRow[];
}): Promise<void> {
  const { jobId, provider, sourceLang, targetLang, videoTitle } = params;

  let done = 0;
  let failed = 0;

  try {
    // Passo 1: o que o cache já resolve não custa nada.
    const cached = await lookupCached({
      provider: provider.name,
      model: provider.model,
      sourceLang,
      targetLang,
      texts: params.pending.map((segment) => segment.text),
    });

    const fromCache = params.pending.filter((segment) => cached.has(segment.text));
    if (fromCache.length > 0) {
      await saveTranslations(
        fromCache.map((segment) => ({
          segmentId: segment.id,
          text: cached.get(segment.text)!,
        })),
        { targetLang, provider },
      );
      done += fromCache.length;
      await updateProgress(jobId, { done, failed });
    }

    const remaining = params.pending.filter(
      (segment) => !cached.has(segment.text),
    );

    // Passo 2: o resto vai para o provedor, em blocos com contexto.
    const positionByIndex = new Map(
      params.segments.map((segment, position) => [segment.index, position]),
    );

    const chunks = buildChunks(
      remaining,
      params.segments,
      (segment) => positionByIndex.get(segment.index) ?? 0,
    );

    for (const chunk of chunks) {
      const outcome = await translateChunkWithRetries({
        provider,
        sourceLang,
        targetLang,
        videoTitle,
        chunk,
      });

      if (outcome.ok) {
        await saveTranslations(outcome.value, { targetLang, provider });
        await storeCached({
          provider: provider.name,
          model: provider.model,
          sourceLang,
          targetLang,
          entries: outcome.value.map((entry) => ({
            sourceText: entry.sourceText,
            text: entry.text,
          })),
        });
        done += chunk.items.length;
      } else {
        await markFailed(
          chunk.items.map((segment) => segment.id),
          { targetLang, provider, reason: outcome.reason },
        );
        failed += chunk.items.length;
      }

      await updateProgress(jobId, { done, failed });
    }

    await db.translationJob.update({
      where: { id: jobId },
      data: {
        status: failed > 0 && done === 0 ? "FAILED" : "DONE",
        done,
        failed,
        finishedAt: new Date(),
        error:
          failed > 0
            ? `${failed} ${failed === 1 ? "bloco não pôde" : "blocos não puderam"} ser traduzido.`
            : null,
      },
    });
  } catch (error) {
    // Falha global (chave inválida, banco fora): o trabalho para, mas o que já
    // foi traduzido continua salvo e visível.
    const message =
      error instanceof TranslationError
        ? error.message
        : "Falha inesperada durante a tradução.";

    console.error("[traducao] trabalho interrompido:", error);

    await db.translationJob
      .update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          done,
          failed,
          error: message,
          finishedAt: new Date(),
        },
      })
      .catch(() => undefined);
  }
}

type ChunkOutcome =
  | { ok: true; value: Array<{ segmentId: string; sourceText: string; text: string }> }
  | { ok: false; reason: string };

async function translateChunkWithRetries(params: {
  provider: TranslationProvider;
  sourceLang: SourceLanguage;
  targetLang: string;
  videoTitle: string;
  chunk: { items: SegmentRow[]; before: string[]; after: string[] };
}): Promise<ChunkOutcome> {
  const { provider, chunk } = params;

  let lastReason = "Não foi possível traduzir este trecho.";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const results = await provider.translateBatch(
        chunk.items.map((segment) => ({ id: segment.index, text: segment.text })),
        {
          sourceLang: params.sourceLang,
          targetLang: params.targetLang,
          before: chunk.before,
          after: chunk.after,
          videoTitle: params.videoTitle,
        },
      );

      const byIndex = new Map(results.map((result) => [result.id, result.text]));

      return {
        ok: true,
        value: chunk.items.map((segment) => ({
          segmentId: segment.id,
          sourceText: segment.text,
          text: byIndex.get(segment.index) ?? "",
        })),
      };
    } catch (error) {
      const isRetryable =
        !(error instanceof TranslationError) || error.retryable;
      lastReason =
        error instanceof TranslationError
          ? error.message
          : "Não foi possível traduzir este trecho.";

      // Erro definitivo (chave inválida, modelo negado) não melhora tentando
      // de novo — e repetir só queima tempo e cota.
      if (!isRetryable) break;

      const delay = RETRY_DELAY_MS[attempt];
      if (delay !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { ok: false, reason: lastReason };
}

async function saveTranslations(
  entries: Array<{ segmentId: string; text: string }>,
  context: { targetLang: string; provider: TranslationProvider },
): Promise<void> {
  for (const entry of entries) {
    await db.translation.upsert({
      where: {
        segmentId_targetLang: {
          segmentId: entry.segmentId,
          targetLang: context.targetLang,
        },
      },
      update: {
        text: entry.text,
        status: "OK",
        error: null,
        provider: context.provider.name,
        model: context.provider.model,
      },
      create: {
        segmentId: entry.segmentId,
        targetLang: context.targetLang,
        text: entry.text,
        status: "OK",
        provider: context.provider.name,
        model: context.provider.model,
      },
    });
  }
}

async function markFailed(
  segmentIds: string[],
  context: {
    targetLang: string;
    provider: TranslationProvider;
    reason: string;
  },
): Promise<void> {
  for (const segmentId of segmentIds) {
    await db.translation.upsert({
      where: {
        segmentId_targetLang: { segmentId, targetLang: context.targetLang },
      },
      update: { status: "FAILED", error: context.reason, text: null },
      create: {
        segmentId,
        targetLang: context.targetLang,
        status: "FAILED",
        error: context.reason,
        provider: context.provider.name,
        model: context.provider.model,
      },
    });
  }
}

async function updateProgress(
  jobId: string,
  progress: { done: number; failed: number },
): Promise<void> {
  await db.translationJob
    .update({ where: { id: jobId }, data: progress })
    .catch(() => undefined);
}

export interface TranslationStatus {
  status: string;
  total: number;
  done: number;
  failed: number;
  error: string | null;
  /** Total de segmentos da faixa e quantos já têm tradução boa. */
  segmentCount: number;
  translatedCount: number;
}

/** Estado atual da tradução de uma faixa, para a tela acompanhar. */
export async function getTranslationStatus(
  trackId: string,
): Promise<TranslationStatus | null> {
  const [job, segmentCount, translatedCount] = await Promise.all([
    db.translationJob.findFirst({
      where: { trackId },
      orderBy: { startedAt: "desc" },
    }),
    db.subtitleSegment.count({ where: { trackId } }),
    db.translation.count({
      where: { status: "OK", segment: { trackId } },
    }),
  ]);

  if (segmentCount === 0) return null;

  return {
    status: job?.status ?? "PENDING",
    total: job?.total ?? 0,
    done: job?.done ?? 0,
    failed: job?.failed ?? 0,
    error: job?.error ?? null,
    segmentCount,
    translatedCount,
  };
}
