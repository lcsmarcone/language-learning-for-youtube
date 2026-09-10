import { z } from "zod";
import { apiError, apiOk, handleRoute, readJsonBody } from "@/lib/api";
import { extractYouTubeId } from "@/lib/youtube";
import { sourceLanguageSchema } from "@/lib/domain";
import { fetchSubtitleWithYtDlp, findYtDlp } from "@/services/subtitles/ytdlp";
import { parseSubtitle } from "@/services/subtitles";

/**
 * Diz se a detecção automática está disponível nesta máquina.
 *
 * A interface consulta isto para decidir entre oferecer a opção ou explicar
 * por que ela está desligada — nunca mostrar um botão que não vai funcionar.
 */
export async function GET() {
  return handleRoute(async () => {
    const binary = await findYtDlp();
    return apiOk({ available: binary !== null });
  });
}

const detectSchema = z.object({
  url: z.string().min(1).max(2048),
  lang: sourceLanguageSchema,
});

/**
 * Baixa a legenda com o yt-dlp e devolve o conteúdo já validado.
 *
 * O conteúdo volta para o cliente em vez de ser gravado direto: assim o fluxo
 * de criação do vídeo continua sendo um só, e o usuário vê quantos blocos
 * vieram antes de confirmar.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJsonBody(request, detectSchema);
    if (!body.ok) return body.response;

    const id = extractYouTubeId(body.data.url);
    if (!id.ok) return apiError(id.reason);

    const fetched = await fetchSubtitleWithYtDlp(id.value, body.data.lang);
    if (!fetched.ok) return apiError(fetched.reason, 422);

    // Conferimos aqui mesmo se o arquivo é aproveitável: melhor falhar agora,
    // com uma mensagem clara, do que criar o vídeo e a tela de estudo abrir
    // vazia.
    const parsed = parseSubtitle(fetched.value.content, {
      filename: "legenda.vtt",
    });
    if (!parsed.ok) return apiError(parsed.reason, 422);

    return apiOk({
      content: fetched.value.content,
      lang: fetched.value.lang,
      automatic: fetched.value.automatic,
      segmentCount: parsed.value.segments.length,
    });
  });
}
