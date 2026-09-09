import { apiError, apiOk, handleRoute } from "@/lib/api";
import { videoMetadataQuerySchema } from "@/lib/schemas";
import { extractYouTubeId, fetchYouTubeMetadata } from "@/lib/youtube";

/**
 * Prévia do vídeo enquanto o usuário digita a URL.
 *
 * Existe para o formulário mostrar título e thumbnail antes de confirmar, o
 * que evita adicionar o vídeo errado e ter que apagar depois.
 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const parsed = videoMetadataQuerySchema.safeParse({
      url: url.searchParams.get("url") ?? "",
    });

    if (!parsed.success) {
      return apiError("Cole o endereço do vídeo.");
    }

    const id = extractYouTubeId(parsed.data.url);
    if (!id.ok) return apiError(id.reason);

    const metadata = await fetchYouTubeMetadata(id.value);
    if (!metadata.ok) return apiError(metadata.reason, 502);

    return apiOk(metadata.value);
  });
}
