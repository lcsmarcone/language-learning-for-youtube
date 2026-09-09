import { z } from "zod";
import { apiError, apiOk, handleRoute, readJsonBody } from "@/lib/api";
import { createFlashcard, listFlashcards } from "@/services/flashcards";

const createSchema = z.object({
  videoId: z.string().min(1),
  startSegmentId: z.string().min(1),
  startOffset: z.number().int().min(0),
  endSegmentId: z.string().min(1),
  endOffset: z.number().int().min(0),
  side: z.enum(["original", "translation"]),
});

export async function GET(request: Request) {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const cards = await listFlashcards({
      videoId: url.searchParams.get("videoId"),
      search: url.searchParams.get("q"),
    });
    return apiOk(cards);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJsonBody(request, createSchema);
    if (!body.ok) return body.response;

    const created = await createFlashcard(body.data);
    if (!created.ok) return apiError(created.reason);

    return apiOk(created.value, { status: 201 });
  });
}
