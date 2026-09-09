import { describe, expect, it } from "vitest";
import { resolveLoopSeek } from "@/lib/loop";

const segments = [
  { startMs: 0, endMs: 2000 },
  { startMs: 4600, endMs: 8000 },
  { startMs: 8000, endMs: 9800 },
];

describe("resolveLoopSeek", () => {
  it("não faz nada quando não há loop", () => {
    expect(resolveLoopSeek({ kind: "none" }, 5000, segments)).toBeNull();
  });

  it("deixa a frase tocar até o fim antes de voltar", () => {
    const loop = { kind: "segment", index: 1 } as const;

    expect(resolveLoopSeek(loop, 4600, segments)).toBeNull();
    expect(resolveLoopSeek(loop, 6000, segments)).toBeNull();
    expect(resolveLoopSeek(loop, 7999, segments)).toBeNull();
  });

  it("volta ao início quando a frase termina", () => {
    const loop = { kind: "segment", index: 1 } as const;

    expect(resolveLoopSeek(loop, 8000, segments)).toBe(4600);
    expect(resolveLoopSeek(loop, 12_000, segments)).toBe(4600);
  });

  it("tolera o seek impreciso do YouTube sem travar o vídeo", () => {
    const loop = { kind: "segment", index: 1 } as const;

    // O player pousa um pouco antes do ponto pedido: isso é normal e não pode
    // disparar um novo salto, senão o vídeo fica preso repetindo o seek.
    expect(resolveLoopSeek(loop, 4200, segments)).toBeNull();
    expect(resolveLoopSeek(loop, 3700, segments)).toBeNull();
  });

  it("traz de volta quando o usuário sai do trecho pela barra do vídeo", () => {
    const loop = { kind: "segment", index: 1 } as const;
    expect(resolveLoopSeek(loop, 1000, segments)).toBe(4600);
  });

  it("funciona igual para o loop A-B", () => {
    const loop = { kind: "ab", startMs: 4600, endMs: 9800 } as const;

    expect(resolveLoopSeek(loop, 7000, segments)).toBeNull();
    expect(resolveLoopSeek(loop, 9800, segments)).toBe(4600);
    expect(resolveLoopSeek(loop, 500, segments)).toBe(4600);
  });

  it("ignora um índice de segmento que não existe mais", () => {
    expect(resolveLoopSeek({ kind: "segment", index: 99 }, 5000, segments)).toBeNull();
  });

  it("ignora trecho com duração inválida em vez de saltar para sempre", () => {
    expect(
      resolveLoopSeek({ kind: "ab", startMs: 5000, endMs: 5000 }, 6000, segments),
    ).toBeNull();
  });
});
