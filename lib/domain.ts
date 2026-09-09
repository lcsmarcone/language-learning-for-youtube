import { z } from "zod";

/**
 * Vocabulário do domínio.
 *
 * O SQLite não tem enums, então os valores "enumerados" do schema Prisma são
 * strings. A validação real acontece aqui, na borda da aplicação, com Zod —
 * e estes mesmos schemas dão os tipos usados no front e no back.
 */

/** Idiomas de origem suportados no v1 (instrucoes.md, "Idiomas suportados"). */
export const SOURCE_LANGUAGES = ["en", "fr", "es"] as const;
export const sourceLanguageSchema = z.enum(SOURCE_LANGUAGES);
export type SourceLanguage = z.infer<typeof sourceLanguageSchema>;

/** Idioma de estudo. Fixo no v1, mas já modelado como valor e não como suposição. */
export const TARGET_LANGUAGES = ["pt-BR"] as const;
export const targetLanguageSchema = z.enum(TARGET_LANGUAGES);
export type TargetLanguage = z.infer<typeof targetLanguageSchema>;

export const LANGUAGE_LABELS: Record<
  SourceLanguage | TargetLanguage,
  string
> = {
  en: "English",
  fr: "Français",
  es: "Español",
  "pt-BR": "Português (Brasil)",
};

export const videoSourceTypeSchema = z.enum(["youtube", "local"]);
export type VideoSourceType = z.infer<typeof videoSourceTypeSchema>;

export const subtitleSourceSchema = z.enum([
  "srt",
  "vtt",
  "transcript",
  "ytdlp",
]);
export type SubtitleSource = z.infer<typeof subtitleSourceSchema>;

export const translationStatusSchema = z.enum(["OK", "FAILED"]);
export type TranslationStatus = z.infer<typeof translationStatusSchema>;

export const translationJobStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "DONE",
  "FAILED",
]);
export type TranslationJobStatus = z.infer<typeof translationJobStatusSchema>;

/**
 * Segmento normalizado — a estrutura que circula entre parser, banco e UI
 * (instrucoes.md secao 4). Os tempos são sempre em milissegundos inteiros;
 * segundos fracionários só aparecem na fronteira com o player.
 */
export interface NormalizedSegment {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

/** Segmento como a tela de estudo consome: com a tradução já resolvida. */
export interface StudySegment extends NormalizedSegment {
  id: string;
  translatedText: string | null;
  translationStatus: TranslationStatus | null;
}
