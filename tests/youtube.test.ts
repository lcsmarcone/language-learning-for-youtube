import { describe, expect, it } from "vitest";
import {
  extractYouTubeId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@/lib/youtube";

function expectId(input: string): string {
  const result = extractYouTubeId(input);
  if (!result.ok) throw new Error(`Esperava um id, veio: ${result.reason}`);
  return result.value;
}

describe("extractYouTubeId", () => {
  it("aceita as formas de URL que as pessoas realmente colam", () => {
    const forms = [
      "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      "https://youtube.com/watch?v=jNQXAC9IVRw",
      "http://m.youtube.com/watch?v=jNQXAC9IVRw",
      "www.youtube.com/watch?v=jNQXAC9IVRw",
      "youtube.com/watch?v=jNQXAC9IVRw",
      "https://youtu.be/jNQXAC9IVRw",
      "https://youtu.be/jNQXAC9IVRw?si=abcdef",
      "https://www.youtube.com/shorts/jNQXAC9IVRw",
      "https://www.youtube.com/embed/jNQXAC9IVRw",
      "https://www.youtube.com/live/jNQXAC9IVRw",
      "https://www.youtube-nocookie.com/embed/jNQXAC9IVRw",
      "https://music.youtube.com/watch?v=jNQXAC9IVRw",
      "  https://www.youtube.com/watch?v=jNQXAC9IVRw  ",
      "jNQXAC9IVRw",
    ];

    for (const form of forms) {
      expect(expectId(form), form).toBe("jNQXAC9IVRw");
    }
  });

  it("ignora parâmetros extras como tempo e playlist", () => {
    expect(
      expectId(
        "https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PL1234&index=2&t=42s",
      ),
    ).toBe("jNQXAC9IVRw");
  });

  it("recusa endereços de outros sites com mensagem legível", () => {
    const result = extractYouTubeId("https://vimeo.com/123456789");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/YouTube/);
  });

  it("recusa texto vazio e URL malformada", () => {
    expect(extractYouTubeId("   ").ok).toBe(false);
    expect(extractYouTubeId("isso não é uma url").ok).toBe(false);
  });

  it("recusa id com tamanho errado", () => {
    const result = extractYouTubeId("https://youtu.be/abc");
    expect(result.ok).toBe(false);
  });

  it("recusa URL do YouTube sem id de vídeo", () => {
    const result = extractYouTubeId("https://www.youtube.com/feed/subscriptions");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/id do vídeo/i);
  });
});

describe("URLs derivadas", () => {
  it("monta endereço canônico e thumbnail a partir do id", () => {
    expect(youtubeWatchUrl("jNQXAC9IVRw")).toBe(
      "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    );
    expect(youtubeThumbnailUrl("jNQXAC9IVRw")).toBe(
      "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
    );
  });
});
