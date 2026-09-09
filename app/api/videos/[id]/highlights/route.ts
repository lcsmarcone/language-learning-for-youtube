import { z } from "zod";
import { apiError, apiOk, handleRoute, readJsonBody } from "@/lib/api";
import { createHighlight, listHighlights } from "@/services/highlights";

const createSchema = z.object({
  startSegmentId: z.string().min(1),
  startOffset: z.number().int().min(0),
  endSegmentId: z.string().min(1),
  endOffset: z.number().int().min(0),
  quotedText: z
    .string()
    .trim()
    .min(1, "Selecione um trecho antes de marcar.")
    .max(5000, "O trecho selecionado é longo demais."),
  translatedText: z.string().max(5000).nullish(),
});

export async function GET(
  _request: Request,
  context: RouteContext<"/api/videos/[id]/highlights">,
) {
  return handleRoute(async () => {
    const { id } = await context.params;
    return apiOk(await listHighlights(id));
  });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/videos/[id]/highlights">,
) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const body = await readJsonBody(request, createSchema);
    if (!body.ok) return body.response;

    const created = await createHighlight({
      videoId: id,
      startSegmentId: body.data.startSegmentId,
      startOffset: body.data.startOffset,
      endSegmentId: body.data.endSegmentId,
      endOffset: body.data.endOffset,
      quotedText: body.data.quotedText,
      translatedText: body.data.translatedText ?? null,
    });

    if (!created.ok) return apiError(created.reason);

    return apiOk(created.value, { status: 201 });
  });
}
