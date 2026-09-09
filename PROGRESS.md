# Progresso do desenvolvimento

> **Para a IA:** este arquivo é a fonte da verdade sobre onde o trabalho parou.
> Leia-o antes de qualquer coisa, continue da primeira etapa não ✅, e atualize-o ao final de cada etapa.
> Legenda: ⬜ pendente · 🔨 em andamento · ✅ concluída

**Última sessão:** 2026-09-09 — Etapas 0 e 1 concluídas (fundação + modelo de dados no SQLite).
**Próximo passo:** Etapa 2 — Parsers de legenda (SRT, VTT, transcrição colada), com testes.

---

## Etapas

### ✅ Etapa 0 — Fundação e mecanismo de retomada
- [x] `git init`, `.gitignore` (node_modules, .next, `.env*`, `*.db`)
- [x] Scaffold Next.js 16 + React 19 + TS strict + Tailwind v4
- [x] Dependências: prisma, @prisma/client, zod, zustand, @tanstack/react-virtual, @anthropic-ai/sdk, clsx, lucide-react, vitest
- [x] `.env.example` + `.env`
- [x] `CLAUDE.md` (regras + regra de retomada) e `PROGRESS.md` (este arquivo)
- [x] Tokens de tema claro/escuro, tipografia, toggle de dark mode
- [x] Scripts npm: dev, build, typecheck, test, db:push, db:studio, db:seed
- **Verificação:** `npm run dev` sobe e mostra a home estilizada; `npm run typecheck` e `npm test` passam.

### ✅ Etapa 1 — Modelo de dados
- [x] `prisma/schema.prisma`: User, Video, SubtitleTrack, SubtitleSegment, Translation, TranslationCache, Highlight, Flashcard, StudyProgress, **TranslationJob**
- [x] Índices: `SubtitleSegment(trackId, startMs)` e único `(trackId, index)`; únicos em `Translation(segmentId, targetLang)`, `TranslationCache(hash)`, `Video(userId, sourceType, externalId)`
- [x] Migration inicial (`prisma/migrations/…_inicial`) + `lib/db.ts` (singleton + adapter better-sqlite3 + `ensureLocalUser`)
- [x] `lib/domain.ts` (enums validados por Zod, rótulos de idioma, tipos `NormalizedSegment`/`StudySegment`) e `lib/time.ts` (formatação de timestamp/duração)
- [x] `prisma/seed.ts` idempotente: 1 vídeo, 10 segmentos, traduções e progresso
- [x] `postinstall: prisma generate` (o client gerado não é versionado)
- **Verificação:** `npm run db:seed` popula; `tests/db.test.ts` cobre o fluxo vídeo→legenda→tradução→highlight→flashcard, o unique de duplicidade e o cascade de exclusão. `npm run build` passa.

### ⬜ Etapa 2 — Parsers de legenda
- [ ] `services/subtitles/parseSrt.ts`, `parseVtt.ts`, `parsePlainTranscript.ts`, `normalize.ts`
- [ ] Tratar BOM, CRLF, `,` vs `.` nos ms, `hh:mm:ss` e `mm:ss`, tags `<i>` / `{\an8}`, blocos NOTE/STYLE, cues sobrepostos, numeração ausente
- [ ] Erros como `{ok:false, reason}` legível
- **Verificação:** suíte Vitest com fixtures reais + casos malformados.

### ⬜ Etapa 3 — Biblioteca e "Adicionar vídeo"
- [ ] Home: estado vazio + grid de cards (thumbnail, título, duração, % concluído, nº flashcards, última vez estudado)
- [ ] Modal Adicionar vídeo: URL do YouTube (youtu.be, /watch, /shorts, /embed), metadados via oEmbed, idioma de origem (en/fr/es), destino pt-BR
- [ ] Legenda: importar arquivo (.srt/.vtt, ≤2 MB) ou colar transcrição; "detectar" desabilitado até a Etapa 10
- [ ] API routes com validação Zod
- **Verificação:** adicionar vídeo real com .srt real → aparece na biblioteca → reload → continua lá.

### ⬜ Etapa 4 — Tela de estudo: player + transcrição sincronizada
- [ ] `components/video/YouTubePlayer.tsx` sobre a IFrame API (play/pause/seek/rate/getTime)
- [ ] `lib/playerStore.ts` (zustand) + loop rAF com throttle; busca binária do segmento ativo
- [ ] Lista virtualizada: timestamp, original, tradução, destaque do ativo, hover `▶ ↻ ★`
- [ ] `[✓ Acompanhar vídeo]` que desliga ao scroll manual + botão "voltar para a legenda atual"
- [ ] Clique no bloco → seek (com guarda anti-seleção); `▶` seek+play; `↻` loop do segmento; loop A-B
- [ ] Controles: play/pause, ±5s, velocidade 0.5–1.5
- [ ] `StudyProgress` com debounce; retoma da última posição ao reabrir
- **Verificação:** passos 1–11 do "Critério de validação adicional" de `instrucoes.md`.

### ⬜ Etapa 5 — Camada de tradução
- [ ] `TranslationProvider` (interface) + `AnthropicProvider` + `MockProvider`
- [ ] Blocos de ~20 segmentos com 2 de contexto antes/depois; saída JSON `[{id,text}]` validada por Zod; 2 retentativas
- [ ] Cache por hash(`provider|model|sourceLang|targetLang|texto`)
- [ ] `POST /api/translate/:trackId` (job) + `GET` (progresso `{done,total,failed}`) + rate limit por track
- [ ] UI de progresso; blocos falhos com "tentar novamente"
- **Verificação:** testes com MockProvider (chunking, mapeamento de ids, cache hit) + tradução real conferida.

### ⬜ Etapa 6 — Seleção e destaque
- [ ] `lib/selection.ts`: Range ↔ `{startSegmentId, startOffset, endSegmentId, endOffset, quotedText}`
- [ ] Seleção no original preservada exatamente; tradução destaca o segmento inteiro correspondente (sem inventar alinhamento palavra-a-palavra)
- [ ] Barra inferior com seleção atual + [★ Criar flashcard] + Esc
- [ ] Highlights persistem e são re-renderizados ao reabrir
- **Verificação:** testes de round-trip, incluindo seleção que cruza segmentos.

### ⬜ Etapa 7 — Flashcards
- [ ] Criar da seleção ou do segmento inteiro (front, back, contexto, timestamps, vídeo)
- [ ] Página `/flashcards` com filtro por vídeo e busca
- [ ] [Copiar Original] [Copiar Tradução] [Copiar Frente+Verso (`Original\tTradução`)] [Ir para o vídeo] [Editar] [Excluir] + toast
- [ ] "Ir para o vídeo" → `/video/[id]?t=<startMs>`
- **Verificação:** passos 9–12 do §25 de `instrucoes.md`.

### ⬜ Etapa 8 — Exportação
- [ ] `services/export/`: `toTsv`, `toCsv` com escaping correto; colunas `Front | Back | Source | Timestamp`
- [ ] `GET /api/flashcards/export?format=tsv&videoId=` → download
- [ ] Seleção múltipla + "Exportar selecionados"
- [ ] `interface FlashcardExporter` deixando AnkiConnect/.apkg como futuro
- **Verificação:** testes de escaping + importar o arquivo no Anki de verdade.

### ⬜ Etapa 9 — Atalhos, estados e acabamento
- [ ] Atalhos: Espaço, ←/→, ↑/↓, R, A, F, Esc, `?` (modal de atalhos); ignorados em input/textarea
- [ ] Estados: biblioteca vazia, sem legenda, legenda inválida, tradução em andamento/parcial/falha, API fora, offline, vídeo indisponível, sem flashcards, skeletons
- [ ] Revisão de design: pouco ruído, tipografia, espaço, poucas cores, dark mode consistente
- **Verificação:** percorrer manualmente cada estado de erro forçando a condição.

### ⬜ Etapa 10 — Detecção opcional de legenda via yt-dlp
- [ ] `services/subtitles/ytdlp.ts` com `execFile` (nunca shell), args fixos, timeout, limite de saída
- [ ] Detecção do binário (`YTDLP_PATH` ou PATH); degradação limpa quando ausente
- **Verificação:** importar legenda de um vídeo com yt-dlp; sem ele, UI desabilita com explicação.

### ⬜ Etapa 11 — Validação final e documentação
- [ ] Suíte completa passando
- [ ] 15 passos do §25 e 13 do "Critério de validação adicional", nos três idiomas (en/fr/es → pt-BR)
- [ ] `README.md`: instalar, configurar `.env`, rodar, migrar, exportar para o Anki, evoluções preparadas
- [ ] Marcar este arquivo como concluído

---

## Decisões tomadas (não reabrir sem motivo)

- **Banco:** SQLite via Prisma. Trocar para Postgres depois = mudar `provider` no schema.
- **Tradução:** Anthropic Claude, contextual em blocos, atrás de `TranslationProvider`.
- **Legendas do YouTube:** import manual é o caminho principal; yt-dlp local é opcional. Sem scraping.
- **Player:** YouTube IFrame API (`seekTo`/`getCurrentTime` disponíveis → clique-para-navegar e loop no MVP).
- **Auth:** nenhuma no v1; `User` singleton local prepara multi-usuário.

## Notas / pendências conhecidas

- `npm audit` acusa vulnerabilidades em `mysql2`, dependência transitiva do **CLI** do Prisma. Não afeta o runtime (usamos SQLite) e não é exposta ao usuário. Reavaliar quando o Prisma atualizar.
- Remote `origin` configurado: https://github.com/lcsmarcone/language-learning-for-youtube (branch `main`).
- **Prisma 7** não embute mais o engine: a conexão exige um driver adapter (`@prisma/adapter-better-sqlite3`), configurado em `lib/db.ts`. A classe exportada chama-se `PrismaBetterSqlite3`.
- O client Prisma é gerado em `lib/generated/prisma` e **não** é versionado; `postinstall` regenera após clonar.
- Config do Prisma fica em `prisma7.config.ts` (padrão do Prisma 7), não em `package.json`.
