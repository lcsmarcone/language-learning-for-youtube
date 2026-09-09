import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSrt } from "@/services/subtitles/parseSrt";

const fixture = readFileSync("tests/fixtures/sample.srt", "utf8");

function expectOk<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`Esperava sucesso, veio: ${result.reason}`);
  return result.value;
}

describe("parseSrt", () => {
  it("lê um arquivo real com BOM, CRLF, tags e entidades", () => {
    const segments = expectOk(parseSrt(fixture));

    expect(segments).toHaveLength(4);
    expect(segments[0]).toEqual({
      index: 0,
      startMs: 1000,
      endMs: 3500,
      text: "All right, so here we are.",
    });
    // <i> removido, {\an8} removido, linhas do bloco unidas por espaço.
    expect(segments[1].text).toBe("In front of the elephants.");
    expect(segments[2].text).toBe(
      "The cool thing about these guys is that they have really long trunks.",
    );
    // Entidades resolvidas.
    expect(segments[3].text).toBe('Jack & Jill said "hi".');
  });

  it("aceita ponto no lugar da vírgula nos milissegundos", () => {
    const segments = expectOk(
      parseSrt("1\n00:00:02.250 --> 00:00:04.750\nOlá.\n"),
    );
    expect(segments[0].startMs).toBe(2250);
    expect(segments[0].endMs).toBe(4750);
  });

  it("aceita blocos sem numeração e com linhas em branco a mais", () => {
    const input = [
      "00:00:01,000 --> 00:00:02,000",
      "Primeira.",
      "",
      "",
      "00:00:02,000 --> 00:00:03,000",
      "Segunda.",
      "",
    ].join("\n");

    const segments = expectOk(parseSrt(input));
    expect(segments.map((s) => s.text)).toEqual(["Primeira.", "Segunda."]);
  });

  it("aceita timestamps curtos no formato mm:ss", () => {
    const segments = expectOk(parseSrt("1\n01:05 --> 01:07\nTexto.\n"));
    expect(segments[0].startMs).toBe(65_000);
    expect(segments[0].endMs).toBe(67_000);
  });

  it("ordena blocos fora de ordem e reindexa", () => {
    const input = [
      "2",
      "00:00:05,000 --> 00:00:06,000",
      "Depois.",
      "",
      "1",
      "00:00:01,000 --> 00:00:02,000",
      "Antes.",
    ].join("\n");

    const segments = expectOk(parseSrt(input));
    expect(segments.map((s) => s.text)).toEqual(["Antes.", "Depois."]);
    expect(segments.map((s) => s.index)).toEqual([0, 1]);
  });

  it("encurta o bloco anterior quando há sobreposição", () => {
    const input = [
      "1",
      "00:00:01,000 --> 00:00:05,000",
      "Longa.",
      "",
      "2",
      "00:00:03,000 --> 00:00:06,000",
      "Sobreposta.",
    ].join("\n");

    const segments = expectOk(parseSrt(input));
    expect(segments[0].endMs).toBe(3000);
    expect(segments[1].startMs).toBe(3000);
  });

  it("dá duração mínima quando o fim vem antes do início", () => {
    const segments = expectOk(
      parseSrt("1\n00:00:10,000 --> 00:00:09,000\nInvertido.\n"),
    );
    expect(segments[0].endMs).toBeGreaterThan(segments[0].startMs);
  });

  it("ignora blocos sem texto em vez de recusar o arquivo", () => {
    const input = [
      "1",
      "00:00:01,000 --> 00:00:02,000",
      "",
      "2",
      "00:00:02,000 --> 00:00:03,000",
      "Tem texto.",
    ].join("\n");

    const segments = expectOk(parseSrt(input));
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Tem texto.");
  });

  it("recusa arquivo vazio com mensagem legível", () => {
    const result = parseSrt("   \n\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/vazio/i);
  });

  it("recusa conteúdo que não é legenda com mensagem legível", () => {
    const result = parseSrt("Isto aqui é só um texto qualquer.\nSem tempos.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/SRT/);
  });

  it("junta palavra partida por hífen no fim da linha", () => {
    const segments = expectOk(
      parseSrt("1\n00:00:01,000 --> 00:00:02,000\nextraor-\ndinário\n"),
    );
    expect(segments[0].text).toBe("extraordinário");
  });
});
