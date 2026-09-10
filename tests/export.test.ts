import { describe, expect, it } from "vitest";
import { CsvExporter, escapeCsv, getExporter, listExporters, TsvExporter } from "@/services/export";
import type { FlashcardView } from "@/services/flashcards";

function card(partial: Partial<FlashcardView> = {}): FlashcardView {
  return {
    id: "c1",
    videoId: "v1",
    videoTitle: "How I Learned English",
    sourceLang: "en",
    front: "I have been studying English for three years.",
    back: "Eu estudo inglês há três anos.",
    contextText: null,
    startMs: 134_000,
    endMs: 137_000,
    createdAt: new Date().toISOString(),
    exportedAt: null,
    ...partial,
  };
}

describe("TsvExporter", () => {
  const exporter = new TsvExporter();

  it("gera as colunas na ordem Front, Back, Source, Timestamp", () => {
    const file = exporter.export([card()], { includeHeader: true });
    const [header, row] = file.content.split("\n");

    expect(header).toBe("Front\tBack\tSource\tTimestamp");
    expect(row).toBe(
      "I have been studying English for three years.\tEu estudo inglês há três anos.\tHow I Learned English\t02:14",
    );
  });

  it("pode sair sem cabeçalho", () => {
    const file = exporter.export([card()], { includeHeader: false });
    expect(file.content.startsWith("Front\t")).toBe(false);
    expect(file.content.split("\n")).toHaveLength(1);
  });

  it("nunca deixa tabulação ou quebra de linha dentro de um campo", () => {
    // Um separador solto no meio do texto deslocaria todas as colunas
    // seguintes e o Anki importaria tudo errado, sem reclamar.
    const file = exporter.export(
      [card({ front: "linha um\nlinha dois", back: "com\ttab" })],
      { includeHeader: false },
    );

    expect(file.content.split("\n")).toHaveLength(1);
    expect(file.content.split("\t")).toHaveLength(4);
    expect(file.content).toContain("linha um linha dois");
    expect(file.content).toContain("com tab");
  });

  it("exporta várias linhas, uma por card", () => {
    const file = exporter.export(
      [card({ id: "a" }), card({ id: "b", front: "Second" })],
      { includeHeader: false },
    );
    expect(file.content.split("\n")).toHaveLength(2);
  });

  it("monta um nome de arquivo seguro a partir do título do vídeo", () => {
    const file = exporter.export([card()], {
      baseName: 'Aula: "inglês"/avançado?',
    });

    expect(file.filename).toMatch(/\.tsv$/);
    expect(file.filename).not.toMatch(/[\\/:*?"<>|]/);
  });
});

describe("CsvExporter", () => {
  const exporter = new CsvExporter();

  it("gera cabeçalho e linha com vírgulas", () => {
    const file = exporter.export([card()], { includeHeader: true });
    const [header] = file.content.split("\r\n");
    expect(header).toBe("Front,Back,Source,Timestamp");
  });

  it("protege campos que contêm vírgula, aspas ou quebra de linha", () => {
    const file = exporter.export(
      [
        card({
          front: 'Ele disse "oi", e saiu',
          back: "linha um\nlinha dois",
          videoTitle: "Aula, parte 2",
        }),
      ],
      { includeHeader: false },
    );

    expect(file.content).toContain('"Ele disse ""oi"", e saiu"');
    expect(file.content).toContain('"linha um\nlinha dois"');
    expect(file.content).toContain('"Aula, parte 2"');
  });

  it("usa CRLF entre as linhas, como o formato pede", () => {
    const file = exporter.export([card({ id: "a" }), card({ id: "b" })], {
      includeHeader: true,
    });
    expect(file.content).toContain("\r\n");
  });
});

describe("escapeCsv", () => {
  it("deixa em paz o que não precisa de aspas", () => {
    expect(escapeCsv("simples")).toBe("simples");
  });

  it("dobra as aspas internas", () => {
    expect(escapeCsv('diz "oi"')).toBe('"diz ""oi"""');
  });
});

describe("registro de formatos", () => {
  it("encontra os formatos disponíveis por id", () => {
    expect(getExporter("tsv")).toBeInstanceOf(TsvExporter);
    expect(getExporter("csv")).toBeInstanceOf(CsvExporter);
    expect(getExporter("apkg")).toBeNull();
  });

  it("lista os formatos com rótulo para a interface", () => {
    const ids = listExporters().map((exporter) => exporter.id);
    expect(ids).toEqual(["tsv", "csv"]);
    expect(listExporters().every((exporter) => exporter.label.length > 0)).toBe(true);
  });
});
