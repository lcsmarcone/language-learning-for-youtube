import { apiError, handleRoute } from "@/lib/api";
import { getExporter } from "@/services/export";
import { listFlashcards } from "@/services/flashcards";
import { db, LOCAL_USER_ID } from "@/lib/db";

/**
 * Baixa os flashcards como arquivo.
 *
 * É uma rota GET de propósito: assim o botão de exportar pode ser um link
 * comum, e o download acontece sem JavaScript montando `Blob` na memória — o
 * que também evita segurar um arquivo grande no navegador.
 *
 * `?ids=` exporta uma seleção; `?videoId=` exporta um vídeo; sem nenhum dos
 * dois, exporta tudo.
 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const url = new URL(request.url);

    const format = url.searchParams.get("format") ?? "tsv";
    const exporter = getExporter(format);
    if (!exporter) {
      return apiError(`Formato "${format}" não é suportado.`, 400);
    }

    const videoId = url.searchParams.get("videoId");
    const idsParam = url.searchParams.get("ids");
    const includeHeader = url.searchParams.get("header") !== "0";

    let cards = await listFlashcards({ videoId });

    if (idsParam) {
      const wanted = new Set(idsParam.split(",").filter(Boolean));
      cards = cards.filter((card) => wanted.has(card.id));
    }

    if (cards.length === 0) {
      return apiError("Nenhum flashcard para exportar.", 404);
    }

    // Na tela, os cards aparecem do mais novo para o mais antigo — é o que se
    // quer ao revisar o que acabou de criar. No arquivo, a ordem útil é a do
    // vídeo: quem importa no Anki reencontra as frases na sequência em que
    // elas aparecem.
    cards.sort(
      (a, b) =>
        a.videoTitle.localeCompare(b.videoTitle) || a.startMs - b.startMs,
    );

    // O nome do arquivo sai do vídeo quando a exportação é de um vídeo só.
    const baseName = videoId
      ? ((
          await db.video.findFirst({
            where: { id: videoId, userId: LOCAL_USER_ID },
            select: { title: true },
          })
        )?.title ?? "flashcards")
      : "flashcards";

    const file = exporter.export(cards, { baseName, includeHeader });

    // O BOM faz o Excel abrir UTF-8 corretamente; o Anki ignora.
    const body = format === "csv" ? `﻿${file.content}` : file.content;

    return new Response(body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "no-store",
      },
    });
  });
}
