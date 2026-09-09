import { apiError, apiOk, handleRoute } from "@/lib/api";
import { deleteHighlight } from "@/services/highlights";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/highlights/[id]">,
) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const removed = await deleteHighlight(id);
    if (!removed) return apiError("Marcação não encontrada.", 404);

    return apiOk({ id });
  });
}
