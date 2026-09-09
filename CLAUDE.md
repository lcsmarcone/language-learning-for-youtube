@AGENTS.md

# Language Learning for YouTube

Aplicação de estudo de idiomas: vídeo → legenda original → tradução → seleção → flashcard → Anki.
Os requisitos completos e imutáveis do produto estão em `instrucoes.md`. Leia-o quando houver dúvida sobre comportamento esperado.

## ⚠️ REGRA Nº 1 — ANTES DE QUALQUER TRABALHO

1. Leia `PROGRESS.md`.
2. Identifique a **primeira etapa não concluída** (não marcada com ✅).
3. Continue exatamente dali. Não recomece etapas já ✅.
4. Ao **terminar** uma etapa:
   - rode `npm run typecheck` e `npm test` (devem passar);
   - marque a etapa como ✅ em `PROGRESS.md`;
   - atualize os campos **Última sessão** e **Próximo passo**;
   - faça commit: `git commit -m "etapa N: <título>"`.
5. Se o usuário disser apenas "continue", isso significa: execute o passo acima sem fazer perguntas.

## Versionamento

- Branch principal: `main`. Trabalho de cada etapa em branch `etapa/N-slug`, com merge em `main` ao concluir.
- **Não** adicionar Claude como co-autor nos commits. Mensagens de commit em português, no formato `etapa N: <título>`.

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript strict |
| Estilo | Tailwind CSS v4 (tokens em `app/globals.css`) |
| Banco | SQLite via Prisma 7 (`prisma/schema.prisma`, arquivo `prisma/dev.db`) |
| Validação | Zod 4 |
| Estado do player | Zustand (store externo, fora do ciclo de render) |
| Lista longa | `@tanstack/react-virtual` |
| Tradução | Anthropic SDK, atrás da interface `TranslationProvider` |
| Testes | Vitest (+ jsdom / Testing Library quando houver DOM) |

## Comandos

```bash
npm run dev         # servidor de desenvolvimento
npm run build       # build de produção
npm run typecheck   # tsc --noEmit (deve passar sempre)
npm test            # Vitest (modo run)
npm run test:watch  # Vitest em watch
npm run db:push     # aplica o schema no SQLite
npm run db:studio   # Prisma Studio
npm run db:seed     # popula dados de exemplo
```

## Convenções

- **Nenhuma chave de API no cliente.** `ANTHROPIC_API_KEY` só é lida em código de servidor (route handlers / server components). Nunca prefixe segredo com `NEXT_PUBLIC_`.
- Todo input de API route é validado com Zod antes de tocar no banco.
- Erros voltam como `{ ok: false, error: "mensagem em português legível" }` — nunca exceção crua vazando para o usuário nem só `console.error`.
- O tempo corrente do vídeo **não** entra em estado React. Vive no store Zustand; só o índice do segmento ativo é publicado, para não re-renderizar a lista inteira várias vezes por segundo.
- Componentes pequenos, por domínio, em `components/<domínio>/`. Lógica pura e testável em `services/` e `lib/`.
- Idiomas de origem suportados: `en`, `fr`, `es`. Destino: `pt-BR`.
- Textos de interface em português do Brasil.

## Estrutura

```
app/          rotas (App Router) e API routes
components/   video, subtitles, highlights, flashcards, library, ui
services/     translation, subtitles (parsers, yt-dlp), export
lib/          store, hooks, utils, schemas zod, atalhos
prisma/       schema, migrations, seed
tests/        Vitest
```

## Princípio de decisão

Entre uma implementação sofisticada e frágil e uma simples e confiável, escolha a confiável.
Nunca entregue tela bonita com dados falsos: o fluxo tem que funcionar de ponta a ponta e sobreviver a um reload.
