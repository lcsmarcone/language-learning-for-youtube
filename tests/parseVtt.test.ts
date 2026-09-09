import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseVtt } from "@/services/subtitles/parseVtt";

const fixture = readFileSync("tests/fixtures/sample.vtt", "utf8");
const rolling = readFileSync("tests/fixtures/rolling-auto.vtt", "utf8");

function expectOk<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`Esperava sucesso, veio: ${result.reason}`);
  return result.value;
}

describe("parseVtt", () => {
  it("lê um arquivo real com NOTE, STYLE, identificadores e configurações de cue", () => {
    const segments = expectOk(parseVtt(fixture));

    expect(segments).toHaveLength(4);
    expect(segments[0]).toEqual({
      index: 0,
      startMs: 1000,
      endMs: 3500,
      text: "All right, so here we are.",
    });
    expect(segments[1].text).toBe("In front of the elephants.");
    // Tag de tempo interna <00:00:06.500> removida.
    expect(segments[2].text).toBe(
      "The cool thing about these guys is that they have really long trunks.",
    );
    expect(segments[3].text).toBe('Jack & Jill said "hi".');
  });

  it("não transforma comentários NOTE em legenda", () => {
    const segments = expectOk(parseVtt(fixture));
    expect(segments.some((s) => s.text.includes("comentário"))).toBe(false);
    expect(segments.some((s) => s.text.includes("::cue"))).toBe(false);
  });

  it("desduplica legendas automáticas em rolagem", () => {
    const segments = expectOk(parseVtt(rolling));

    expect(segments.map((s) => s.text)).toEqual([
      "all right so here we are",
      "in front of the elephants",
      "the cool thing about these guys",
    ]);
  });

  it("aceita arquivo sem o cabeçalho WEBVTT", () => {
    const segments = expectOk(
      parseVtt("00:00:01.000 --> 00:00:02.000\nSem cabeçalho.\n"),
    );
    expect(segments[0].text).toBe("Sem cabeçalho.");
  });

  it("aceita timestamps no formato mm:ss.mmm", () => {
    const segments = expectOk(
      parseVtt("WEBVTT\n\n01:05.500 --> 01:07.000\nCurto.\n"),
    );
    expect(segments[0].startMs).toBe(65_500);
    expect(segments[0].endMs).toBe(67_000);
  });

  it("recusa arquivo vazio e conteúdo que não é legenda", () => {
    expect(parseVtt("").ok).toBe(false);

    const result = parseVtt("WEBVTT\n\nsó texto solto, sem tempos\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/VTT/);
  });
});
