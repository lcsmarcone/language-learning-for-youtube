import { err, ok, type Result } from "@/lib/result";

/**
 * Tudo que envolve identificar e descrever um vídeo do YouTube.
 *
 * Duas decisões deliberadas aqui:
 *
 * 1. **Nada de scraping.** Os metadados vêm do endpoint oEmbed público
 *    (`/oembed`), que existe justamente para isso. Nenhuma página é raspada,
 *    nenhum termo de uso é contrariado (instrucoes.md secao 4).
 * 2. **A URL chamada é construída por nós**, a partir do id extraído — nunca a
 *    string que o usuário digitou. Isso fecha a porta para SSRF: por mais
 *    criativa que seja a entrada, o servidor só busca youtube.com.
 */

/** Ids do YouTube têm 11 caracteres do alfabeto base64url. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * Extrai o id de vídeo das formas que as pessoas realmente colam:
 * `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`, com ou sem
 * protocolo, com parâmetros extras (`&t=42s`, `?si=...`, listas).
 *
 * Aceita também o id puro colado sozinho.
 */
export function extractYouTubeId(input: string): Result<string> {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return err("Cole o endereço do vídeo.");
  }

  if (VIDEO_ID.test(trimmed)) {
    return ok(trimmed);
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return err("O endereço não parece uma URL válida.");
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return err(
      "Por enquanto só aceitamos vídeos do YouTube. Outras fontes entram em uma versão futura.",
    );
  }

  const candidate = candidateFromUrl(url, host);

  if (!candidate) {
    return err("Não encontramos o id do vídeo nesse endereço.");
  }
  if (!VIDEO_ID.test(candidate)) {
    return err("O id do vídeo nesse endereço parece inválido.");
  }

  return ok(candidate);
}

function candidateFromUrl(url: URL, host: string): string | null {
  // youtu.be/<id>
  if (host.endsWith("youtu.be")) {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  const fromQuery = url.searchParams.get("v");
  if (fromQuery) return fromQuery;

  // /shorts/<id>, /embed/<id>, /live/<id>, /v/<id>
  const parts = url.pathname.split("/").filter(Boolean);
  const prefixed = ["shorts", "embed", "live", "v"];
  if (parts.length >= 2 && prefixed.includes(parts[0])) {
    return parts[1];
  }

  return null;
}

/** URL canônica do vídeo — a que guardamos no banco. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Thumbnail. Não depende de rede: o padrão de URL da imagem é estável e
 * público, então serve de reserva quando o oEmbed falha.
 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export interface YouTubeMetadata {
  videoId: string;
  title: string;
  authorName: string | null;
  thumbnailUrl: string;
}

/**
 * Busca título e thumbnail via oEmbed.
 *
 * Falha aqui não é fatal: o usuário continua conseguindo adicionar o vídeo,
 * só que com um título provisório que ele pode corrigir. Vídeo privado,
 * removido ou sem internet caem todos neste caminho.
 */
export async function fetchYouTubeMetadata(
  videoId: string,
  options: { timeoutMs?: number } = {},
): Promise<Result<YouTubeMetadata>> {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", youtubeWatchUrl(videoId));
  endpoint.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 6000,
  );

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (response.status === 401 || response.status === 403) {
      return err(
        "Esse vídeo é privado ou tem reprodução restrita, então não conseguimos ler os dados dele.",
      );
    }
    if (response.status === 404) {
      return err("Vídeo não encontrado no YouTube. Confira o endereço.");
    }
    if (!response.ok) {
      return err("O YouTube não respondeu como esperado. Tente novamente.");
    }

    const data = (await response.json()) as {
      title?: unknown;
      author_name?: unknown;
      thumbnail_url?: unknown;
    };

    const title =
      typeof data.title === "string" && data.title.trim().length > 0
        ? data.title.trim()
        : `Vídeo ${videoId}`;

    return ok({
      videoId,
      title,
      authorName:
        typeof data.author_name === "string" ? data.author_name : null,
      thumbnailUrl:
        typeof data.thumbnail_url === "string" && data.thumbnail_url.length > 0
          ? data.thumbnail_url
          : youtubeThumbnailUrl(videoId),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return err("A consulta ao YouTube demorou demais. Tente novamente.");
    }
    return err("Não foi possível falar com o YouTube. Verifique sua conexão.");
  } finally {
    clearTimeout(timeout);
  }
}
