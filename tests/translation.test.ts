import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { buildChunks, CHUNK_SIZE } from "@/services/translation/chunk";
import { MockTranslationProvider } from "@/services/translation/mock";
import { translationHash } from "@/services/translation/cache";
import { lookupCached, storeCached } from "@/services/translation/cache";
import { db } from "@/lib/db";
import type { TranslationContext } from "@/services/translation/types";

afterAll(async () => {
  await db.translationCache
    .deleteMany({ where: { provider: "teste" } })
    .catch(() => undefined);
  await db.$disconnect();
});

const segments = Array.from({ length: 50 }, (_, i) => ({
  index: i,
  text: `frase ${i}`,
}));

describe("buildChunks", () => {
  it("divide em blocos do tamanho configurado", () => {
    const chunks = buildChunks(segments, segments, (s) => s.index);

    expect(chunks).toHaveLength(Math.ceil(50 / CHUNK_SIZE));
    expect(chunks[0].items).toHaveLength(CHUNK_SIZE);
    expect(chunks.at(-1)?.items).toHaveLength(50 % CHUNK_SIZE);
    // Nenhum segmento se perde nem se repete na divisão.
    expect(chunks.flatMap((c) => c.items.map((i) => i.index))).toEqual(
      segments.map((s) => s.index),
    );
  });

  it("acrescenta frases vizinhas como contexto, sem incluí-las no bloco", () => {
    const chunks = buildChunks(segments, segments, (s) => s.index, {
      chunkSize: 10,
      contextSize: 2,
    });

    // O primeiro bloco não tem nada antes dele.
    expect(chunks[0].before).toEqual([]);
    expect(chunks[0].after).toEqual(["frase 10", "frase 11"]);

    expect(chunks[1].before).toEqual(["frase 8", "frase 9"]);
    expect(chunks[1].after).toEqual(["frase 20", "frase 21"]);

    // O último não tem nada depois.
    expect(chunks.at(-1)?.after).toEqual([]);
  });

  it("puxa contexto dos segmentos já traduzidos, que ficam fora do bloco", () => {
    // Só as frases 20 a 24 precisam de tradução; o contexto vem das vizinhas.
    const pending = segments.slice(20, 25);
    const positionByIndex = new Map(segments.map((s, i) => [s.index, i]));

    const chunks = buildChunks(
      pending,
      segments,
      (s) => positionByIndex.get(s.index)!,
      { chunkSize: 10, contextSize: 2 },
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].items.map((i) => i.index)).toEqual([20, 21, 22, 23, 24]);
    expect(chunks[0].before).toEqual(["frase 18", "frase 19"]);
    expect(chunks[0].after).toEqual(["frase 25", "frase 26"]);
  });

  it("lida com lista vazia", () => {
    expect(buildChunks([], segments, () => 0)).toEqual([]);
  });
});

describe("MockTranslationProvider", () => {
  const context: TranslationContext = {
    sourceLang: "en",
    targetLang: "pt-BR",
    before: [],
    after: [],
  };

  it("devolve um resultado por item, com o mesmo id", async () => {
    const provider = new MockTranslationProvider();
    const items = [
      { id: 3, text: "hello" },
      { id: 4, text: "world" },
    ];

    const results = await provider.translateBatch(items, context);

    expect(results.map((r) => r.id)).toEqual([3, 4]);
    expect(results[0].text).toContain("hello");
  });

  it("recebe o contexto das falas vizinhas", async () => {
    let seen: TranslationContext | null = null;
    const provider = new MockTranslationProvider({
      onBatch: (_items, ctx) => {
        seen = ctx;
      },
    });

    await provider.translateBatch([{ id: 0, text: "x" }], {
      ...context,
      before: ["antes"],
      after: ["depois"],
      videoTitle: "Aula",
    });

    expect(seen).not.toBeNull();
    expect(seen!.before).toEqual(["antes"]);
    expect(seen!.after).toEqual(["depois"]);
    expect(seen!.videoTitle).toBe("Aula");
  });
});

describe("cache de traduções", () => {
  it("muda a chave quando o modelo muda", () => {
    const base = {
      provider: "anthropic",
      sourceLang: "en",
      targetLang: "pt-BR",
      text: "hello",
    };

    const comModeloA = translationHash({ ...base, model: "modelo-a" });
    const comModeloB = translationHash({ ...base, model: "modelo-b" });

    expect(comModeloA).not.toBe(comModeloB);
  });

  it("mesma entrada gera sempre a mesma chave", () => {
    const input = {
      provider: "anthropic",
      model: "m",
      sourceLang: "en",
      targetLang: "pt-BR",
      text: "hello",
    };
    expect(translationHash(input)).toBe(translationHash(input));
  });

  it("distingue idiomas de origem diferentes para o mesmo texto", () => {
    const base = {
      provider: "anthropic",
      model: "m",
      targetLang: "pt-BR",
      text: "no",
    };
    expect(translationHash({ ...base, sourceLang: "en" })).not.toBe(
      translationHash({ ...base, sourceLang: "es" }),
    );
  });

  it("grava e recupera traduções, evitando pagar duas vezes", async () => {
    const key = {
      provider: "teste",
      model: "m1",
      sourceLang: "en",
      targetLang: "pt-BR",
    };

    await storeCached({
      ...key,
      entries: [
        { sourceText: "I don't know", text: "Eu não sei" },
        { sourceText: "See you", text: "Até mais" },
      ],
    });

    const found = await lookupCached({
      ...key,
      texts: ["I don't know", "See you", "nunca visto"],
    });

    expect(found.get("I don't know")).toBe("Eu não sei");
    expect(found.get("See you")).toBe("Até mais");
    expect(found.has("nunca visto")).toBe(false);
  });

  it("gravar de novo o mesmo texto não quebra", async () => {
    const key = {
      provider: "teste",
      model: "m2",
      sourceLang: "en",
      targetLang: "pt-BR",
    };

    await storeCached({ ...key, entries: [{ sourceText: "hi", text: "oi" }] });
    await expect(
      storeCached({ ...key, entries: [{ sourceText: "hi", text: "oi" }] }),
    ).resolves.toBeUndefined();
  });

  it("não encontra nada quando o modelo é outro", async () => {
    const entries = [{ sourceText: "only here", text: "só aqui" }];
    await storeCached({
      provider: "teste",
      model: "m3",
      sourceLang: "en",
      targetLang: "pt-BR",
      entries,
    });

    const found = await lookupCached({
      provider: "teste",
      model: "outro-modelo",
      sourceLang: "en",
      targetLang: "pt-BR",
      texts: ["only here"],
    });

    expect(found.size).toBe(0);
  });
});
