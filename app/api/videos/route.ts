import { apiError, apiOk, handleRoute, readJsonBody } from "@/lib/api";
import { db, LOCAL_USER_ID } from "@/lib/db";
import { createVideoSchema } from "@/lib/schemas";
import {
  extractYouTubeId,
  fetchYouTubeMetadata,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@/lib/youtube";
import { parseSubtitle } from "@/services/subtitles";
import { createVideoWithSubtitle, listLibrary } from "@/services/library";

export async function GET() {
  return handleRoute(async () => {
    const videos = await listLibrary();
    return apiOk(videos);
  });
}

/**
 * Adiciona um vídeo com sua legenda.
 *
 * A ordem importa: validar entrada → resolver o id → **parsear a legenda antes
 * de gravar qualquer coisa** → só então criar. Assim um arquivo inválido nunca
 * deixa um vídeo órfão sem legenda na biblioteca.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJsonBody(request, createVideoSchema);
    if (!body.ok) return body.response;

    const { url, sourceLang, targetLang, title, subtitle } = body.data;

    const id = extractYouTubeId(url);
    if (!id.ok) return apiError(id.reason);
    const videoId = id.value;

    const parsed = parseSubtitle(subtitle.content, {
      filename: subtitle.filename ?? null,
    });
    if (!parsed.ok) return apiError(parsed.reason);

    if (parsed.value.segments.length === 0) {
      return apiError(
        "A legenda foi lida, mas não tem nenhuma fala. Confira o arquivo.",
      );
    }

    const existing = await db.video.findFirst({
      where: {
        userId: LOCAL_USER_ID,
        sourceType: "youtube",
        externalId: videoId,
      },
      select: { id: true, title: true },
    });
    if (existing) {
      return apiError(
        `"${existing.title}" já está na sua biblioteca.`,
        409,
      );
    }

    // Metadados são um plus: se o YouTube não responder, seguimos com o título
    // informado pelo usuário ou um provisório. Adicionar o vídeo não pode
    // depender de uma chamada externa dar certo.
    const metadata = await fetchYouTubeMetadata(videoId);

    const resolvedTitle =
      title?.trim() ||
      (metadata.ok ? metadata.value.title : `Vídeo ${videoId}`);

    const { video } = await createVideoWithSubtitle({
      externalId: videoId,
      url: youtubeWatchUrl(videoId),
      title: resolvedTitle,
      thumbnailUrl: metadata.ok
        ? metadata.value.thumbnailUrl
        : youtubeThumbnailUrl(videoId),
      sourceLang,
      targetLang,
      subtitle: {
        segments: parsed.value.segments,
        source: parsed.value.source,
        timingsApproximate: parsed.value.timingsApproximate,
        label: subtitle.filename ?? null,
      },
    });

    return apiOk(
      {
        id: video.id,
        title: video.title,
        segmentCount: parsed.value.segments.length,
        timingsApproximate: parsed.value.timingsApproximate,
        /** Avisa a UI quando o título é provisório por falha de rede. */
        metadataWarning: metadata.ok ? null : metadata.reason,
      },
      { status: 201 },
    );
  });
}
