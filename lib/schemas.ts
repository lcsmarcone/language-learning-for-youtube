import { z } from "zod";
import { sourceLanguageSchema, targetLanguageSchema } from "@/lib/domain";

/**
 * Schemas de entrada das API routes.
 *
 * Ficam num arquivo só porque são o contrato entre cliente e servidor: o mesmo
 * schema tipa o formulário no navegador e valida o corpo no servidor, então
 * não existe divergência silenciosa entre os dois lados.
 */

/** Tamanho máximo do texto de legenda aceito de uma vez. */
export const MAX_SUBTITLE_CHARS = 1_500_000;

export const subtitleInputSchema = z.object({
  /** Conteúdo do arquivo (.srt/.vtt) ou transcrição colada. */
  content: z
    .string()
    .min(1, "Envie o conteúdo da legenda.")
    .max(
      MAX_SUBTITLE_CHARS,
      "A legenda é grande demais. Envie um arquivo menor que 2 MB.",
    ),
  /** Nome do arquivo, quando veio de upload. Só serve como pista de formato. */
  filename: z.string().max(255).nullish(),
});

export const createVideoSchema = z.object({
  url: z
    .string()
    .min(1, "Cole o endereço do vídeo.")
    .max(2048, "O endereço é longo demais."),
  sourceLang: sourceLanguageSchema,
  targetLang: targetLanguageSchema.default("pt-BR"),
  /** Título informado à mão, usado quando o YouTube não responde. */
  title: z.string().trim().min(1).max(300).nullish(),
  subtitle: subtitleInputSchema,
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;

export const videoMetadataQuerySchema = z.object({
  url: z.string().min(1).max(2048),
});
