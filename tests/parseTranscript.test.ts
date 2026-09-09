import { describe, expect, it } from "vitest";
import { parsePlainTranscript } from "@/services/subtitles/parsePlainTranscript";
import { detectFormat, parseSubtitle } from "@/services/subtitles";

function expectOk<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`Esperava sucesso, veio: ${result.reason}`);
  return result.value;
}

describe("parsePlainTranscript", () => {
  it("usa os tempos reais da transcrição copiada do YouTube", () => {
    const input = [
      "0:00",
      "All right, so here we are",
      "0:04",
      "in front of the elephants",
      "0:09",
      "the cool thing about these guys",
    ].join("\n");

    const parsed = expectOk(parsePlainTranscript(input));

    expect(parsed.timingsApproximate).toBe(false);
    expect(parsed.segments.map((s) => s.startMs)).toEqual([0, 4000, 9000]);
    // O fim de um bloco é o começo do próximo.
    expect(parsed.segments[0].endMs).toBe(4000);
    expect(parsed.segments[1].text).toBe("in front of the elephants");
  });

  it("aceita uma única marca de tempo quando ela cobre todo o texto", () => {
    const parsed = expectOk(
      parsePlainTranscript("0:09\nnever gonna give you up"),
    );

    expect(parsed.timingsApproximate).toBe(false);
    expect(parsed.segments).toHaveLength(1);
    expect(parsed.segments[0].startMs).toBe(9000);
    // A linha do tempo não pode virar texto falado.
    expect(parsed.segments[0].text).toBe("never gonna give you up");
  });

  it("não confunde prosa que menciona um horário com transcrição", () => {
    const input = [
      "Cheguei em casa cansado.",
      "3:15 e ele já tinha ido embora",
      "No dia seguinte tudo mudou.",
    ].join("\n");

    const parsed = expectOk(parsePlainTranscript(input));

    expect(parsed.timingsApproximate).toBe(true);
    expect(parsed.segments).toHaveLength(3);
    expect(parsed.segments[1].text).toBe("3:15 e ele já tinha ido embora");
  });

  it("aceita tempo e texto na mesma linha", () => {
    const input = ["0:00 All right, so here we are", "0:04 in front of the elephants"].join("\n");

    const parsed = expectOk(parsePlainTranscript(input));
    expect(parsed.timingsApproximate).toBe(false);
    expect(parsed.segments[0].text).toBe("All right, so here we are");
    expect(parsed.segments[1].startMs).toBe(4000);
  });

  it("usa a duração do vídeo para fechar o último bloco", () => {
    const input = ["0:00", "primeira", "0:04", "última"].join("\n");

    const parsed = expectOk(parsePlainTranscript(input, { durationSec: 19 }));
    expect(parsed.segments.at(-1)?.endMs).toBe(19_000);
  });

  it("estima tempos e marca como aproximado quando não há timestamps", () => {
    const input =
      "All right, so here we are. In front of the elephants. And that's cool.";

    const parsed = expectOk(parsePlainTranscript(input, { durationSec: 30 }));

    expect(parsed.timingsApproximate).toBe(true);
    expect(parsed.segments).toHaveLength(3);
    expect(parsed.segments[0].startMs).toBe(0);
    // Os tempos cobrem o vídeo inteiro, sem buracos entre blocos.
    expect(parsed.segments.at(-1)?.endMs).toBeCloseTo(30_000, -2);
    for (let i = 1; i < parsed.segments.length; i += 1) {
      expect(parsed.segments[i].startMs).toBe(parsed.segments[i - 1].endMs);
    }
  });

  it("trata cada linha colada como um bloco", () => {
    const input = ["primeira linha", "segunda linha", "terceira linha"].join("\n");

    const parsed = expectOk(parsePlainTranscript(input));
    expect(parsed.segments.map((s) => s.text)).toEqual([
      "primeira linha",
      "segunda linha",
      "terceira linha",
    ]);
  });

  it("quebra parágrafo muito longo sem cortar palavra ao meio", () => {
    const longWordy = `${"palavra ".repeat(120)}`.trim();

    const parsed = expectOk(parsePlainTranscript(longWordy));

    expect(parsed.segments.length).toBeGreaterThan(1);
    for (const segment of parsed.segments) {
      expect(segment.text.length).toBeLessThanOrEqual(220);
      expect(segment.text).not.toMatch(/^\S*palavr$/);
    }
    // Nenhum texto foi perdido na quebra.
    expect(parsed.segments.map((s) => s.text).join(" ")).toBe(longWordy);
  });

  it("recusa transcrição vazia com mensagem legível", () => {
    const result = parsePlainTranscript("   \n  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/transcrição/i);
  });
});

describe("detectFormat", () => {
  it("reconhece VTT pelo cabeçalho", () => {
    expect(detectFormat("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\noi")).toBe("vtt");
  });

  it("reconhece SRT pela vírgula nos milissegundos", () => {
    expect(detectFormat("1\n00:00:01,000 --> 00:00:02,000\noi")).toBe("srt");
  });

  it("usa a extensão só para desempatar", () => {
    const ambiguous = "1\n00:00:01 --> 00:00:02\noi";
    expect(detectFormat(ambiguous, "legenda.vtt")).toBe("vtt");
    expect(detectFormat(ambiguous, "legenda.srt")).toBe("srt");
  });

  it("cai para transcrição quando não há linha de tempo", () => {
    expect(detectFormat("só um texto qualquer")).toBe("transcript");
  });
});

describe("parseSubtitle", () => {
  it("detecta o formato pelo conteúdo, não pela extensão do arquivo", () => {
    const vttContent = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nOlá.\n";

    const parsed = expectOk(
      parseSubtitle(vttContent, { filename: "legenda.txt" }),
    );

    expect(parsed.source).toBe("vtt");
    expect(parsed.timingsApproximate).toBe(false);
    expect(parsed.segments[0].text).toBe("Olá.");
  });

  it("propaga a mensagem de erro do parser escolhido", () => {
    const result = parseSubtitle("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/vazio/i);
  });
});

describe("parseSubtitle — coerência com a extensão do arquivo", () => {
  it("recusa .srt sem nenhum bloco de tempo em vez de tratar como transcrição", () => {
    const result = parseSubtitle("isso não é uma legenda", {
      filename: "aula.srt",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/marcação de tempo/i);
  });

  it("recusa .vtt sem blocos de tempo", () => {
    const result = parseSubtitle("texto solto", { filename: "aula.vtt" });
    expect(result.ok).toBe(false);
  });

  it("aceita .txt com transcrição solta", () => {
    const result = parseSubtitle("Primeira frase. Segunda frase.", {
      filename: "aula.txt",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.source).toBe("transcript");
  });

  it("aceita transcrição colada sem nome de arquivo", () => {
    const result = parseSubtitle("Primeira frase. Segunda frase.");
    expect(result.ok).toBe(true);
  });
});
