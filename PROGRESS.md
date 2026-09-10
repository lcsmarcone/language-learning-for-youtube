# Progresso do desenvolvimento

> **Para a IA:** este arquivo é a fonte da verdade sobre onde o trabalho parou.
> Leia-o antes de qualquer coisa, continue da primeira etapa não ✅, e atualize-o ao final de cada etapa.
> Legenda: ⬜ pendente · 🔨 em andamento · ✅ concluída

**Última sessão:** 2026-09-10 — Etapas 0 a 10 concluídas.
**Próximo passo:** Etapa 11 — Validação final e README.

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

### ✅ Etapa 2 — Parsers de legenda
- [x] `services/subtitles/`: `normalize.ts`, `parseSrt.ts`, `parseVtt.ts`, `parsePlainTranscript.ts`, `index.ts` (`parseSubtitle` + `detectFormat`)
- [x] Tratam BOM, CRLF, `,` vs `.` nos ms, `hh:mm:ss` e `mm:ss`, tags `<i>`/`<c>`/`<00:00:01.000>`/`{\an8}`, entidades HTML, blocos NOTE/STYLE/REGION, identificadores de cue, cues fora de ordem e sobrepostos, numeração ausente, palavra partida por hífen
- [x] `lib/result.ts`: tipo `Result` — falha de dado do usuário é retorno, não exceção
- [x] `lib/sync.ts`: busca binária tempo → segmento (`findActiveSegmentIndex`, `findNearestSegmentIndex`, `resolveHighlightedIndex`)
- [x] Erros como `{ok:false, reason}` em português
- **Verificação:** 43 testes (`parseSrt`, `parseVtt`, `parseTranscript`, `sync`, `db`, `smoke`), com fixtures de BOM/CRLF e casos malformados. Conferido à mão que acentuação de FR/ES sobrevive intacta.

**Ganhos além do previsto nesta etapa:**
- Transcrição copiada do YouTube (linhas `0:15` + texto, ou `0:15 texto`) é reconhecida e usa os **tempos reais** — não fica marcada como aproximada.
- Legenda automática do YouTube em "rolagem" (cada cue repetindo o texto do anterior) é desduplicada; sem isso a transcrição sairia com cada frase duas ou três vezes.

### ✅ Etapa 3 — Biblioteca e "Adicionar vídeo"
- [x] Home: estado vazio + seções "Continue estudando"/"Todos os vídeos", cards com thumbnail, idioma, duração, % concluído, nº de flashcards, % traduzido e aviso de sincronia aproximada
- [x] Modal `AddVideoDialog` com prévia ao vivo do vídeo (título/autor/thumbnail) enquanto se digita, com debounce
- [x] `lib/youtube.ts`: `extractYouTubeId` (watch, youtu.be, shorts, embed, live, nocookie, music, id puro, parâmetros extras) + `fetchYouTubeMetadata` via **oEmbed** com timeout
- [x] Legenda: importar arquivo (.srt/.vtt/.txt, ≤2 MB) ou colar transcrição; "detectar" desabilitado com explicação até a Etapa 10
- [x] `lib/api.ts` (envelope `{ok,data}`/`{ok,error}`, limite de corpo, `handleRoute`), `lib/schemas.ts` (Zod), `services/library.ts` (consultas + criação transacional em lotes de 500)
- [x] Rotas: `GET/POST /api/videos`, `DELETE /api/videos/[id]`, `GET /api/youtube/metadata`
- **Verificação:** exercitado de ponta a ponta com vídeos reais do YouTube — criar, duplicar (409), legenda inválida, idioma inválido, remover, 404 — e no navegador: prévia ao vivo, erro de duplicado na tela, criação e reload mantendo os dados.

**Correções feitas a partir dos testes desta etapa:**
- `.srt`/`.vtt` sem nenhum bloco de tempo agora dá erro explicativo em vez de virar uma "transcrição" de um bloco só.
- Mensagens do Zod traduzidas (o idioma inválido devolvia texto em inglês).
- Transcrição com **uma única** marca de tempo que cobre todo o texto passa a usar o tempo real, sem deixar a linha `0:09` virar texto falado. Prosa que menciona um horário continua sendo tratada como prosa.

**Pendência conhecida (resolvida na Etapa 4):** `durationSec` fica nulo ao adicionar, porque o oEmbed não informa duração. O player sabe a duração e vai gravá-la na primeira reprodução.

### ✅ Etapa 4 — Tela de estudo: player + transcrição sincronizada
- [x] `components/video/YouTubePlayer.tsx` sobre a IFrame API oficial, com `ref` imperativa (play/pause/seek/nudge/rate) e tratamento dos códigos de erro do player
- [x] `lib/playerStore.ts` (zustand, fora do React) — só `activeIndex` é publicado para a lista; `currentMs` só o relógio assina
- [x] Lista virtualizada (`@tanstack/react-virtual`) com timestamp, original, tradução, destaque do ativo e ações `▶ ↻` no hover (o `★` entra na Etapa 7, junto com os flashcards)
- [x] `[✓ Acompanhar vídeo]` desliga sozinho no scroll manual (wheel, toque, teclas e **arrasto da barra de rolagem**) + botão "Voltar para a legenda atual"
- [x] Clique no bloco → seek, com guarda dupla contra conflito com seleção de texto (arrasto > 4 px ou seleção existente cancelam a navegação)
- [x] `lib/loop.ts` — regra do loop isolada e testada; loop de frase e loop A-B
- [x] Controles: play/pause, ±5 s, velocidade 0.5–1.5×, relógio
- [x] `StudyProgress` gravado a cada 5 s e no `pagehide` via `sendBeacon`; ao reabrir, o player retoma da posição salva
- [x] `services/study.ts` + `PATCH/POST /api/videos/[id]/progress`; a **duração** do vídeo é capturada do player e gravada (o oEmbed não informa)
- **Verificação no navegador, com vídeo real:** clique numa frase distante levou o player ao tempo dela; destaque e auto-scroll acompanharam; o vídeo tocou até o fim; recarregar a página retomou do ponto salvo; arrastar sobre o texto **não** navegou; o loop foi verificado ponta a ponta (passou do fim → voltou ao início; no meio → não interferiu; saiu do trecho → voltou). Mais 8 testes unitários da regra do loop.

**Dois problemas reais encontrados testando no app (não apareceriam em teste unitário):**
1. **`requestAnimationFrame` congela em aba de segundo plano.** O vídeo continuava tocando com áudio, mas a transcrição parava de acompanhar e o loop deixava de voltar ao início. Trocado por `setInterval` de 100 ms, que o navegador apenas desacelera (~1 Hz) em vez de congelar.
2. **A legenda do próprio YouTube aparecia sobreposta ao vídeo** (em outro idioma), competindo com a nossa. Desligada com `cc_load_policy: 0`.

**Nota de ambiente:** em perfil novo do Chrome, a política de autoplay bloqueia o `playVideo()` até o navegador acumular interação — não é falha do app; basta o usuário clicar uma vez.
**Ferramenta de depuração:** em desenvolvimento, o store fica em `window.__playerStore` (tempo, segmento ativo, loop) — foi assim que os dois problemas acima foram diagnosticados.

### ✅ Etapa 5 — Camada de tradução
- [x] `services/translation/`: `types.ts` (interface `TranslationProvider`), `anthropic.ts`, `mock.ts`, `cache.ts`, `chunk.ts`, `job.ts`, `index.ts`
- [x] Blocos de 20 segmentos com 2 frases de contexto antes/depois (contexto **não** é traduzido de volta)
- [x] **Saída estruturada** (`output_config.format` com schema Zod, via `client.messages.parse`) — o modelo é obrigado a devolver um item por segmento com o id de volta, e o resultado ainda é realinhado por id antes de gravar
- [x] 3 tentativas por bloco com espera crescente; erro definitivo (chave inválida) não é repetido
- [x] Cache por hash(`provider|model|sourceLang|targetLang|texto`), global entre vídeos
- [x] `POST /api/translate/[trackId]` (dispara e responde 202) + `GET` (progresso); um trabalho por faixa, sem disparo duplicado
- [x] `TranslationBar` com progresso ao vivo, retomada se a página for reaberta durante a tradução, e "Traduzir o que falta" quando há falhas
- [x] Chave lida só no servidor; a UI recebe apenas um booleano dizendo se há provedor configurado
- **Verificação com a API real (Claude Sonnet 5), nos três idiomas:** espanhol 6 segmentos em 8,0 s, francês 5 em 4,7 s, inglês 5 em 3,1 s — zero falhas. **Cache:** repetir o mesmo texto levou 0,6 s e não criou nenhuma entrada nova, ou seja, nenhuma chamada paga. No navegador: botão → barra de progresso → traduções aparecendo na transcrição.

**Qualidade conferida à mão** (o ponto do produto, instrucoes.md secao 5 — tradução natural, não literal):
- `Me dejaron colgado` → "Me deixaram na mão"
- `No te rayes, hombre` → "Não se estressa, cara"
- `Il m'a envoyé balader` → "Ele me mandou passear"
- `pero es que yo pensaba que esta vez sí...` → "mas eu achava que dessa vez ia dar certo..." (o sentido elidido foi completado pelo contexto)
- `I have been putting up with this for years` → "eu venho aguentando isso há anos"

**Bug real corrigido nesta etapa:** a API do YouTube **substitui** o elemento que recebe pelo `<iframe>`, em vez de preenchê-lo. Como esse elemento era renderizado pelo React, qualquer troca de tela derrubava a aplicação com `Failed to execute 'removeChild' on 'Node'`. Agora o nó entregue ao YouTube é criado à mão dentro de um invólucro que o React controla, e o erro do player virou uma camada sobreposta em vez de trocar a árvore. Descoberto ao abrir um vídeo com reprodução bloqueada pelo dono — que, de quebra, mostrou o estado "vídeo indisponível" funcionando.

### ✅ Etapa 6 — Seleção e destaque
- [x] `lib/selection.ts`: leitura da seleção do DOM → `{side, startSegmentId, startOffset, endSegmentId, endOffset, quotedText, segmentIds}`, com `textOffsetWithin` que conta deslocamento mesmo com o texto já partido por destaques
- [x] Seleção no original preservada **exatamente** por deslocamento de caractere; o outro lado destaca o **segmento inteiro** correspondente — sem inventar alinhamento palavra a palavra (instrucoes.md secao 6)
- [x] Funciona nos dois sentidos: selecionar na tradução destaca o original
- [x] `lib/selectionStore.ts` (zustand): cada bloco assina só se participa da seleção, para a lista virtualizada não repintar inteira a cada arrasto
- [x] `SegmentText` + `segmentMarkRanges`/`splitByRanges` (funções puras) renderizam os destaques salvos, inclusive atravessando vários blocos
- [x] Barra inferior mostrando os dois lados + [Marcar trecho] + [Cancelar] (Esc também limpa)
- [x] `services/highlights.ts` + `POST/GET /api/videos/[id]/highlights` + `DELETE /api/highlights/[id]`; destaques voltam renderizados ao reabrir o vídeo
- **Verificação:** 105 testes, incluindo uma suíte em jsdom que monta o mesmo DOM da tela e lê seleções reais (bloco único, cruzando blocos, arrastada de trás para frente, com texto já partido por destaque anterior, misturando os dois lados). No navegador: selecionar no original destacou a tradução inteira, marcar salvou, recarregar manteve a marcação.

**Bug real encontrado testando no navegador:** numa seleção que cruza blocos, `selection.toString()` do navegador traz **a tradução do meio junto** — original e tradução são vizinhos no DOM, então ir do bloco 7 ao 8 arrasta o português do 7 no caminho. Um flashcard nascido daí teria português na frente em inglês. Agora o texto salvo é remontado a partir dos dados e dos deslocamentos, não do que o navegador devolve, e por isso é idêntico ao que será destacado ao reabrir.

### ✅ Etapa 7 — Flashcards
- [x] `services/flashcards.ts`: cria a partir da seleção **ou** do bloco inteiro; o servidor deriva frente, verso, contexto e tempos do banco — o cliente só manda onde a seleção começa e termina
- [x] A frente é **sempre** o idioma original e o verso sempre o português, independentemente de qual lado foi selecionado (é assim que o card funciona no Anki)
- [x] O lado selecionado é recortado pelos deslocamentos; o outro lado entra com os segmentos inteiros
- [x] Contexto = frase anterior + selecionada + seguinte
- [x] `★` na linha da legenda cria o card com um clique; a barra de seleção tem [Criar flashcard] e [Marcar]
- [x] Página `/flashcards` com busca e filtro por vídeo (no cliente, para digitar ser instantâneo)
- [x] [Original] [Tradução] [Frente + verso] (`Original\tTradução`) [Ir para o vídeo] [Editar] [Excluir], com toast de confirmação
- [x] `lib/clipboard.ts` com caminho alternativo quando a API moderna é bloqueada; TAB e quebra de linha viram espaço para não desalinhar a importação
- [x] "Ir para o vídeo" → `/video/[id]?t=<startMs>`, e o player abre naquele instante
- **Verificação no navegador:** `★` criou o card com contexto correto; seleção parcial criou card com a frente recortada e o verso inteiro; a página listou os dois; copiar mostrou o ícone de confirmado e o toast; "Ir para o vídeo" abriu o player em 00:14 com o bloco certo ativo. 118 testes, incluindo os recortes de frente/verso, a inversão de lados e o escape do formato do Anki.

**Nota de verificação:** não consegui ler o conteúdo do clipboard pelo navegador automatizado (a leitura abre um pedido de permissão que trava a página). O formato copiado é coberto por teste unitário (`frontBackLine`), e o retorno visual do clique foi conferido na tela.

### ✅ Etapa 8 — Exportação
- [x] `services/export/`: `TsvExporter` e `CsvExporter` atrás da interface `FlashcardExporter`, com registro por id — AnkiConnect e `.apkg` entram como classe nova, sem refatorar nada
- [x] Colunas `Front | Back | Source | Timestamp`, com cabeçalho opcional
- [x] Escape por formato: no TSV, tabulação e quebra de linha viram espaço (o formato não tem escape de verdade); no CSV, aspas dobradas e CRLF, com BOM para o Excel abrir UTF-8
- [x] `GET /api/flashcards/export?format=&videoId=&ids=` devolve o arquivo como anexo; os botões são links diretos, sem `Blob` montado no navegador
- [x] Seleção múltipla na página de flashcards + "Exportar selecionados"; sem seleção, exporta o que está filtrado
- [x] O arquivo sai **na ordem do vídeo**, não na ordem de criação — quem importa reencontra as frases na sequência em que aparecem
- **Verificação:** 130 testes (escaping de TSV e CSV, nome de arquivo seguro, registro de formatos). Exportação real conferida: cabeçalhos HTTP, nome do arquivo, conteúdo dos dois formatos, campos com vírgula e aspas protegidos, e os erros de "nenhum card" e "formato inválido".

**Pendente para você:** importar o `.tsv` gerado no Anki de verdade — é o único passo que não dá para verificar daqui.

### ✅ Etapa 9 — Atalhos, estados e acabamento
- [x] `lib/shortcuts.ts` é a **fonte única**: a mesma constante governa o teclado e o modal de ajuda, então a ajuda não pode descrever um atalho que não existe
- [x] Atalhos: `Espaço` play/pause, `←/→` ±5 s, `↑/↓` frase anterior/próxima, `R` repetir, `A` marcar A-B (duas vezes: início e fim), `F` flashcard, `Esc` cancelar seleção ou parar repetição, `?` ajuda
- [x] Ignorados quando o foco está em input, textarea, select, área editável ou dentro de um diálogo aberto; combinações com Ctrl/Cmd/Alt não são roubadas do navegador
- [x] Botão de teclado no cabeçalho da tela de estudo abre a mesma ajuda
- [x] `OfflineBanner`: avisa sem bloquear — dá para continuar assistindo offline
- [x] Esqueletos de carregamento nas três telas (`loading.tsx`), `error.tsx` com "tentar de novo", `not-found.tsx`
- **Verificação:** 139 testes, incluindo o mapeamento de teclas, o respeito a Ctrl/Cmd/Alt e as quatro situações em que o atalho deve ser ignorado. Build passa com todas as rotas.

**Estados cobertos (instrucoes.md secao 18):** biblioteca vazia ✅ · vídeo sem legenda ✅ · legenda inválida ✅ · falha na tradução ✅ · tradução parcial ✅ · tradução em andamento ✅ · API indisponível ✅ · vídeo indisponível ✅ · erro de rede ✅ · offline ✅ · nenhum flashcard ✅ · carregando ✅

**Não verificado no navegador:** a extensão do Chrome desconectou durante esta etapa, então os atalhos foram validados só por teste unitário. O comportamento na tela (incluindo o loop A-B pelo teclado) precisa de uma conferida manual.

### ✅ Etapa 10 — Detecção opcional de legenda via yt-dlp
- [x] `services/subtitles/ytdlp.ts` com `execFile` (nunca shell), argumentos fixos, timeout e limite de saída; a URL é construída a partir do id extraído, então o texto digitado nunca chega à linha de comando
- [x] Detecção do binário por `YTDLP_PATH` ou PATH, com cache no processo; ausente = a opção some da interface com explicação, e o caminho manual segue como principal
- [x] **Duas etapas**: consulta as faixas disponíveis (`--dump-single-json`) e baixa exatamente uma
- [x] Preferência de faixa: oficial no idioma exato → oficial em variante regional → automática no idioma → automática `-orig` (o áudio original quando há dublagem). Faixas traduzidas por máquina a partir de outro idioma são recusadas — para quem aprende, elas não correspondem ao que se ouve
- [x] `GET/POST /api/youtube/subtitles`; a UI mostra quantos blocos vieram e avisa quando a legenda é automática
- [x] Mensagens acionáveis para os erros reais: yt-dlp desatualizado (`yt-dlp -U`), limite 429, vídeo privado, vídeo indisponível, sem conexão
- **Verificação com yt-dlp real (2025.07.21) instalado:** baixou a faixa oficial `en` de um vídeo real (60 blocos) e o fluxo detectar→criar vídeo funcionou de ponta a ponta. Os erros de "versão desatualizada" e "429" foram vistos de verdade e produzem as mensagens certas. 151 testes.

**Descoberto testando:** a primeira versão pedia as faixas por padrão de idioma (`en.*`) numa chamada só. Parecia mais simples, mas o YouTube devolve também as faixas traduzidas automaticamente de outros idiomas — quatro downloads onde bastava um, risco de escolher uma tradução de máquina em vez da original, e erro 429 por excesso de requisições, que abortava a execução inteira mesmo com o arquivo certo já baixado.

**Nota:** o yt-dlp instalado nesta máquina (2025.07.21) não abre alguns vídeos que o YouTube passou a restringir — inclusive o vídeo de exemplo do seed. `yt-dlp -U` resolve, e a mensagem na tela diz isso.

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
- `npm run typecheck` roda `next typegen` antes do `tsc`: os tipos de rota (`RouteContext`, `LayoutProps`) são gerados pelo Next e não existem num clone limpo.
