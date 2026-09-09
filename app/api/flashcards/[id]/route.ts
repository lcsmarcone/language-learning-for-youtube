import { z } from "zod";
import { apiError, apiOk, handleRoute, readJsonBody } from "@/lib/api";
import { deleteFlashcard, updateFlashcard } from "@/services/flashcards";

const updateSchema = z
  .object({
    front: z.string().trim().min(1, "A frente não pode ficar vazia.").max(5000),
    back: z.string().trim().max(5000),
    contextText: z.string().max(5000).nullish(),
  })
  .partial();

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/flashcards/[id]">,
) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const body = await readJsonBody(request, updateSchema);
    if (!body.ok) return body.response;

    const updated = await updateFlashcard(id, body.data);
    if (!updated.ok) return apiError(updated.reason, 404);

    return apiOk(updated.value);
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/flashcards/[id]">,
) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const removed = await deleteFlashcard(id);
    if (!removed) return apiError("Flashcard não encontrado.", 404);

    return apiOk({ id });
  });
}
