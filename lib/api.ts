import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/**
 * Contrato único das API routes.
 *
 * Toda resposta é `{ ok: true, data }` ou `{ ok: false, error }`, com `error`
 * já escrito em português e pronto para ir à tela. O cliente nunca precisa
 * interpretar status HTTP para saber o que dizer ao usuário
 * (instrucoes.md secao 18).
 */

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, init);
}

export function apiError(message: string, status = 400) {
  return NextResponse.json<ApiResponse<never>>(
    { ok: false, error: message },
    { status },
  );
}

/** Tamanho máximo aceito num corpo de requisição (legenda inclusa). */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Lê e valida o corpo JSON.
 *
 * Rejeita antes de parsear quando o `Content-Length` já denuncia excesso —
 * não adianta gastar memória com um arquivo de 50 MB para depois recusar.
 */
export async function readJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: apiError(
        "O conteúdo enviado é grande demais (limite de 2 MB).",
        413,
      ),
    };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: apiError("Não conseguimos ler os dados enviados.", 400),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      response: apiError(
        first?.message ?? "Os dados enviados são inválidos.",
        400,
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Envelope para handlers: converte exceção inesperada numa mensagem legível
 * em vez de deixar o Next devolver um stack trace.
 *
 * O erro real vai para o log do servidor; o usuário recebe algo acionável.
 */
export async function handleRoute<T>(
  fn: () => Promise<NextResponse<ApiResponse<T>> | NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error("[api] erro não tratado:", error);
    return apiError(
      "Algo deu errado do nosso lado. Tente novamente em instantes.",
      500,
    );
  }
}
