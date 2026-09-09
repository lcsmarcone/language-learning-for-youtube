import { apiError, apiOk, handleRoute } from "@/lib/api";
import { db, LOCAL_USER_ID } from "@/lib/db";
import { TranslationError } from "@/services/translation";
import {
  getTranslationStatus,
  startTranslationJob,
  TranslationJobError,
} from "@/services/translation/job";

/**
 * Dispara a tradução de uma faixa.
 *
 * Responde assim que o trabalho começa; o progresso é consultado pelo GET.
 * Traduzir uma legenda longa leva minutos, e segurar a requisição durante todo
 * esse tempo daria timeout no navegador.
 */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/translate/[trackId]">,
) {
  return handleRoute(async () => {
    const { trackId } = await context.params;

    const owned = await ownsTrack(trackId);
    if (!owned) return apiError("Legenda não encontrada.", 404);

    try {
      const result = await startTranslationJob(trackId);
      return apiOk(result, { status: 202 });
    } catch (error) {
      if (error instanceof TranslationJobError) {
        return apiError(error.message, 409);
      }
      if (error instanceof TranslationError) {
        // Falta de chave é erro de configuração, não do pedido.
        return apiError(error.message, error.retryable ? 503 : 400);
      }
      throw error;
    }
  });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/translate/[trackId]">,
) {
  return handleRoute(async () => {
    const { trackId } = await context.params;

    const owned = await ownsTrack(trackId);
    if (!owned) return apiError("Legenda não encontrada.", 404);

    const status = await getTranslationStatus(trackId);
    if (!status) return apiError("Esta legenda não tem blocos de texto.", 404);

    return apiOk(status);
  });
}

/** Impede mexer na legenda de outra pessoa quando houver autenticação. */
async function ownsTrack(trackId: string): Promise<boolean> {
  const track = await db.subtitleTrack.findFirst({
    where: { id: trackId, video: { userId: LOCAL_USER_ID } },
    select: { id: true },
  });
  return track !== null;
}
