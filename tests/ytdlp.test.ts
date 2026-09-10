import { describe, expect, it } from "vitest";
import { chooseSubtitleTrack, describeYtDlpError } from "@/services/subtitles/ytdlp";

/**
 * A escolha da faixa é a parte que decide a **qualidade** do que o usuário vai
 * estudar, então é ela que fica coberta por teste. Chamar o yt-dlp de verdade
 * dependeria de rede, da versão instalada e do humor do YouTube — foi
 * verificado à mão, e está registrado no PROGRESS.md.
 */

describe("chooseSubtitleTrack", () => {
  it("prefere a faixa oficial no idioma exato", () => {
    const escolha = chooseSubtitleTrack(
      { en: [], "pt-BR": [] },
      { en: [], "en-orig": [] },
      "en",
    );
    expect(escolha).toEqual({ code: "en", automatic: false });
  });

  it("aceita variante regional quando não há o código exato", () => {
    const escolha = chooseSubtitleTrack({ "en-US": [] }, {}, "en");
    expect(escolha).toEqual({ code: "en-US", automatic: false });
  });

  it("só usa legenda automática quando não existe oficial", () => {
    const escolha = chooseSubtitleTrack({}, { en: [] }, "en");
    expect(escolha).toEqual({ code: "en", automatic: true });
  });

  it("prefere o áudio original entre as automáticas", () => {
    // "en-orig" é a faixa que corresponde ao que está sendo falado quando o
    // vídeo tem dublagens; as outras não batem com o áudio.
    const escolha = chooseSubtitleTrack({}, { "en-CA": [], "en-orig": [] }, "en");
    expect(escolha).toEqual({ code: "en-orig", automatic: true });
  });

  it("ignora faixas traduzidas por máquina a partir de outro idioma", () => {
    // Para quem está aprendendo, uma tradução automática do japonês para o
    // inglês é pior que nada: não corresponde ao que se ouve.
    const escolha = chooseSubtitleTrack(
      { ja: [], "pt-BR": [] },
      { "ja-en": [], "ja-de": [] },
      "en",
    );
    expect(escolha).toBeNull();
  });

  it("devolve null quando o idioma não existe no vídeo", () => {
    expect(chooseSubtitleTrack({ en: [] }, { en: [] }, "fr")).toBeNull();
  });

  it("não confunde idiomas cujo código começa igual", () => {
    // "es" não pode casar com "est" (estoniano) nem "en" com "eng-x".
    expect(chooseSubtitleTrack({ est: [] }, {}, "es")).toBeNull();
  });
});

describe("describeYtDlpError", () => {
  it("orienta a atualizar quando a versão instalada ficou para trás", () => {
    const mensagem = describeYtDlpError(
      new Error("ERROR: [youtube] abc: The following content is not available on this app."),
    );
    expect(mensagem).toMatch(/yt-dlp -U/);
  });

  it("explica o limite de requisições", () => {
    expect(describeYtDlpError(new Error("HTTP Error 429: Too Many Requests"))).toMatch(
      /limitou os pedidos/i,
    );
  });

  it("explica vídeo privado", () => {
    expect(describeYtDlpError(new Error("ERROR: Private video"))).toMatch(
      /privado/i,
    );
  });

  it("explica falta de conexão", () => {
    expect(describeYtDlpError(new Error("urlopen error [Errno 11001] getaddrinfo failed"))).toMatch(
      /conexão/i,
    );
  });

  it("tem mensagem de último caso, nunca texto cru do processo", () => {
    const mensagem = describeYtDlpError(new Error("algo muito estranho aconteceu"));
    expect(mensagem).not.toContain("algo muito estranho");
    expect(mensagem).toMatch(/Importe o arquivo/);
  });
});
