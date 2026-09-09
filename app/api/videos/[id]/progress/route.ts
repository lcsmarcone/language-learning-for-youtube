import { z } from "zod";
import { apiError, apiOk, handleRoute, readJsonBody } from "@/lib/api";
import { saveProgress } from "@/services/study";

const progressSchema = z.object({
  lastPositionMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  durationSec: z.number().int().min(0).max(24 * 60 * 60).nullish(),
});

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/videos/[id]/progress">,
) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const body = await readJsonBody(request, progressSchema);
    if (!body.ok) return body.response;

    const saved = await saveProgress({
      videoId: id,
      lastPositionMs: body.data.lastPositionMs,
      durationSec: body.data.durationSec ?? null,
    });

    if (!saved) return apiError("Vídeo não encontrado.", 404);

    return apiOk({ id });
  });
}

/**
 * `navigator.sendBeacon` só faz POST, e é ele que garante a última gravação
 * quando a aba é fechada. Por isso o POST existe e delega ao PATCH.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/videos/[id]/progress">,
) {
  return PATCH(request, context);
}
