import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { err, ok, type Result } from "@/lib/result";
import { youtubeWatchUrl } from "@/lib/youtube";

/**
 * Obtenção de legenda pelo `yt-dlp` instalado na máquina do usuário.
 *
 * Este é o caminho **opcional** (instrucoes.md secao 4). As decisões por trás
 * dele:
 *
 * - Nada de scraping no servidor. Quem baixa é uma ferramenta que o usuário
 *   escolheu instalar, rodando na máquina dele, sobre a conta dele.
 * - A ausência do programa não é erro: a opção some da interface com uma
 *   explicação, e o caminho manual continua sendo o principal.
 * - O processo é chamado com `execFile` e lista fixa de argumentos, nunca por
 *   shell, e a URL é construída por nós a partir do id — o texto que o usuário
 *   digitou não chega à linha de comando.
 *
 * O trabalho é feito em **duas etapas**: primeiro perguntamos quais faixas
 * existem, depois baixamos exatamente uma. Pedir por padrão de idioma numa
 * chamada só parecia mais simples, mas o YouTube devolve também as faixas
 * traduzidas automaticamente a partir de outros idiomas — o que significa
 * quatro downloads onde bastava um, risco de escolher a faixa traduzida por
 * máquina em vez da original, e erro 429 por excesso de requisições.
 */

const execFileAsync = promisify(execFile);

/** Tempo máximo por chamada. Legendas são pequenas; isto é folga. */
const TIMEOUT_MS = 60_000;

/** Limite de saída do processo — o JSON de metadados de um vídeo é grande. */
const MAX_BUFFER = 32 * 1024 * 1024;

let cachedBinary: string | null | undefined;

/**
 * Encontra o executável. O resultado fica em cache no processo: procurar a
 * cada requisição custaria um processo novo só para descobrir o óbvio.
 */
export async function findYtDlp(): Promise<string | null> {
  if (cachedBinary !== undefined) return cachedBinary;

  const candidates = [process.env.YTDLP_PATH?.trim(), "yt-dlp"].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 15_000 });
      cachedBinary = candidate;
      return candidate;
    } catch {
      // Próximo candidato.
    }
  }

  cachedBinary = null;
  return null;
}

/** Só para os testes: esquece o que foi detectado. */
export function resetYtDlpCache(): void {
  cachedBinary = undefined;
}

export interface SubtitleTrackChoice {
  /** Código exato da faixa, como o yt-dlp a nomeia (ex.: "en", "en-US"). */
  code: string;
  /** true quando é legenda automática (reconhecimento de fala). */
  automatic: boolean;
}

/**
 * Escolhe a melhor faixa disponível para o idioma pedido.
 *
 * A ordem de preferência é deliberada, do melhor para o pior:
 *
 * 1. faixa **oficial** no idioma exato — foi escrita por uma pessoa;
 * 2. faixa oficial numa variante regional (`en-US` quando se pediu `en`);
 * 3. faixa **automática** no idioma exato — sem pontuação confiável, mas
 *    ainda é o áudio daquele vídeo;
 * 4. faixa automática numa variante.
 *
 * Faixas traduzidas por máquina a partir de outro idioma ficam de fora: para
 * quem está aprendendo, elas são pior que nada, porque não correspondem ao que
 * está sendo falado.
 */
export function chooseSubtitleTrack(
  official: Record<string, unknown>,
  automatic: Record<string, unknown>,
  lang: string,
): SubtitleTrackChoice | null {
  const isVariant = (code: string) => isSameLanguage(code, lang);

  // "en-orig" é como o YouTube marca o áudio original quando o vídeo tem
  // dublagens; é a faixa que corresponde ao que se ouve.
  const rank = (code: string) => {
    if (code === lang) return 0;
    if (code.toLowerCase() === `${lang.toLowerCase()}-orig`) return 1;
    return 2;
  };

  const pick = (source: Record<string, unknown>) =>
    Object.keys(source)
      .filter(isVariant)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0] ?? null;

  const officialCode = pick(official);
  if (officialCode) return { code: officialCode, automatic: false };

  const automaticCode = pick(automatic);
  if (automaticCode) return { code: automaticCode, automatic: true };

  return null;
}

/**
 * Diz se um código de faixa é o idioma pedido — e não uma tradução automática
 * a partir de outro idioma.
 *
 * O YouTube usa a mesma forma `xx-yy` para duas coisas diferentes, e confundir
 * as duas entrega ao usuário um texto que não corresponde ao áudio:
 *
 * - `en-US`, `pt-BR`, `es-419` → **variante regional**. O sufixo é código de
 *   região: maiúsculo ou numérico. É o mesmo idioma, e serve.
 * - `en-de`, `xh-de`, `yi-de` → **tradução automática** ("English from
 *   German", "Xhosa from German"). O sufixo é código de idioma, minúsculo.
 *   Para quem está aprendendo, isso é pior que nada.
 *
 * `-orig` é caso à parte: marca a faixa do áudio original em vídeos dublados,
 * e é justamente a que queremos.
 */
export function isSameLanguage(code: string, lang: string): boolean {
  const normalized = code.toLowerCase();
  const wanted = lang.toLowerCase();

  if (normalized === wanted) return true;
  if (normalized === `${wanted}-orig`) return true;
  if (!normalized.startsWith(`${wanted}-`)) return false;

  const suffix = code.slice(lang.length + 1);
  // Região: numérica (419) ou em maiúsculas (US, BR). Qualquer sufixo
  // alfabético minúsculo é idioma de origem, ou seja, tradução de máquina.
  return /^[0-9]+$/.test(suffix) || suffix === suffix.toUpperCase();
}

export interface FetchSubtitleResult {
  /** Conteúdo do arquivo VTT. */
  content: string;
  /** Código da faixa efetivamente baixada. */
  lang: string;
  /** true quando a legenda é automática. */
  automatic: boolean;
}

export async function fetchSubtitleWithYtDlp(
  videoId: string,
  lang: string,
): Promise<Result<FetchSubtitleResult>> {
  const binary = await findYtDlp();
  if (!binary) {
    return err(
      "O yt-dlp não está instalado nesta máquina. Importe o arquivo de legenda ou cole a transcrição.",
    );
  }

  const url = youtubeWatchUrl(videoId);

  // Etapa 1: descobrir o que existe.
  let metadata: { subtitles?: Record<string, unknown>; automatic_captions?: Record<string, unknown> };
  try {
    const { stdout } = await execFileAsync(
      binary,
      ["--skip-download", "--no-playlist", "--no-warnings", "--dump-single-json", url],
      { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true },
    );
    metadata = JSON.parse(stdout);
  } catch (error) {
    return err(describeYtDlpError(error));
  }

  const choice = chooseSubtitleTrack(
    metadata.subtitles ?? {},
    metadata.automatic_captions ?? {},
    lang,
  );

  if (!choice) {
    return err(
      "Este vídeo não tem legenda nesse idioma. Importe um arquivo .srt/.vtt ou cole a transcrição.",
    );
  }

  // Etapa 2: baixar exatamente a faixa escolhida.
  const directory = await mkdtemp(join(tmpdir(), "legendas-"));

  try {
    const args = [
      "--skip-download",
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      choice.automatic ? "--write-auto-subs" : "--write-subs",
      "--sub-langs",
      choice.code,
      "--sub-format",
      "vtt/best",
      "--convert-subs",
      "vtt",
      "--output",
      join(directory, "legenda.%(ext)s"),
      url,
    ];

    await execFileAsync(binary, args, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    });

    const files = (await readdir(directory)).filter((name) => name.endsWith(".vtt"));
    if (files.length === 0) {
      return err(
        "O yt-dlp encontrou a legenda mas não conseguiu baixá-la. Tente de novo em instantes.",
      );
    }

    const content = await readFile(join(directory, files[0]), "utf8");
    if (content.trim().length === 0) {
      return err("A legenda baixada veio vazia.");
    }

    return ok({ content, lang: choice.code, automatic: choice.automatic });
  } catch (error) {
    return err(describeYtDlpError(error));
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function describeYtDlpError(error: unknown): string {
  const message =
    error instanceof Error
      ? `${error.message} ${"stderr" in error ? String(error.stderr ?? "") : ""}`
      : String(error);

  if (/timed out|ETIMEDOUT/i.test(message)) {
    return "O yt-dlp demorou demais para responder. Tente novamente ou importe o arquivo.";
  }
  if (/429|Too Many Requests/i.test(message)) {
    return "O YouTube limitou os pedidos temporariamente. Espere alguns minutos e tente de novo.";
  }
  // Sintoma clássico de yt-dlp desatualizado: o YouTube muda a API e as
  // versões antigas param de conseguir abrir o vídeo. A solução é atualizar,
  // então é isso que a mensagem diz.
  if (/not available on this app|Please report this issue|nsig extraction failed/i.test(message)) {
    // O comando certo depende de como o yt-dlp foi instalado: `-U` só funciona
    // na instalação avulsa e briga com gerenciadores de pacote, então damos as
    // duas formas em vez de mandar o usuário para um comando que pode falhar.
    return "Seu yt-dlp está desatualizado para a versão atual do YouTube. Atualize com `winget upgrade yt-dlp` (Windows), `brew upgrade yt-dlp` (macOS) ou `yt-dlp -U`, e tente de novo.";
  }
  if (/private video|Sign in to confirm|members-only|age|bot/i.test(message)) {
    return "Este vídeo é privado, restrito ou exige login, então a legenda não pode ser baixada por aqui.";
  }
  if (/Video unavailable|has been removed|This video is unavailable/i.test(message)) {
    return "Vídeo indisponível no YouTube.";
  }
  if (/urlopen error|getaddrinfo|Connection|Temporary failure/i.test(message)) {
    return "Não foi possível falar com o YouTube. Verifique sua conexão.";
  }

  console.error("[yt-dlp] falha:", message);
  return "O yt-dlp não conseguiu obter a legenda deste vídeo. Importe o arquivo ou cole a transcrição.";
}
