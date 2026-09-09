import { apiError, apiOk, handleRoute } from "@/lib/api";
import { deleteVideo } from "@/services/library";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/videos/[id]">,
) {
  return handleRoute(async () => {
    const { id } = await context.params;

    const removed = await deleteVideo(id);
    if (!removed) {
      return apiError("Vídeo não encontrado na sua biblioteca.", 404);
    }

    return apiOk({ id });
  });
}
