/**
 * Resultado explícito para operações que podem falhar por culpa do dado de
 * entrada (arquivo de legenda estranho, URL inválida, resposta ruim da API).
 *
 * Motivo de existir: nenhuma dessas falhas é excepcional — são o dia a dia de
 * um app que aceita arquivo do usuário. Tratá-las como retorno, e não como
 * exceção, obriga quem chama a decidir o que mostrar na tela, que é
 * exatamente o que a instrucoes.md secao 18 pede.
 *
 * `throw` fica reservado para bug de programação e falha de infraestrutura.
 */

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; reason: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(reason: E): Result<never, E> {
  return { ok: false, reason };
}
