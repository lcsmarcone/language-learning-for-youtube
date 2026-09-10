# Estudo por vídeo

Aprenda idiomas com os vídeos que você realmente quer assistir.

O fluxo é um só, e o produto inteiro existe para deixá-lo sem atrito:

**vídeo → legenda original → tradução → seleção → flashcard → Anki**

Idiomas de origem: inglês, francês e espanhol. Tradução para português do Brasil.

---

## O que dá para fazer

- **Adicionar um vídeo do YouTube** colando a URL — título e capa aparecem antes de confirmar.
- **Trazer a legenda** de três formas: importar `.srt`/`.vtt`, colar a transcrição (a do YouTube, com marcas de tempo, funciona), ou detectar automaticamente se você tiver `yt-dlp` instalado.
- **Traduzir para o português** com o Claude, em blocos com contexto — o resultado sai natural, não literal.
- **Assistir com a legenda sincronizada**: clicar numa frase leva o vídeo até ela, e a transcrição acompanha a reprodução sem arrastar a tela enquanto você lê outro trecho.
- **Repetir uma frase em loop** quantas vezes quiser, ou marcar um trecho A-B.
- **Selecionar um pedaço do texto** e ver a frase correspondente no outro idioma destacada.
- **Transformar a seleção em flashcard**, com contexto e timestamp.
- **Copiar para o Anki** com um clique, ou exportar tudo em TSV/CSV.
- **Fechar e voltar depois**: o vídeo retoma do ponto exato onde parou.

---

## Como rodar

Requisitos: **Node.js 20+** (testado no 22). Nada de banco de dados para instalar — os dados ficam num arquivo SQLite local.

```bash
git clone https://github.com/lcsmarcone/language-learning-for-youtube.git
cd language-learning-for-youtube
npm install                # gera o client do Prisma automaticamente
cp .env.example .env       # depois edite conforme abaixo
npx prisma migrate deploy  # cria o banco em prisma/dev.db
npm run db:seed            # opcional: um vídeo de exemplo para experimentar
npm run dev
```

Abra <http://localhost:3000>.

### Configuração (`.env`)

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | Caminho do banco SQLite. O padrão `file:./prisma/dev.db` serve. |
| `ANTHROPIC_API_KEY` | Necessária para traduzir. Sem ela o app funciona, mas o botão de traduzir fica desabilitado com explicação. Pegue em <https://console.anthropic.com/>. |
| `ANTHROPIC_MODEL` | Modelo usado na tradução. Padrão `claude-sonnet-5`. |
| `TRANSLATION_PROVIDER` | `anthropic` ou `mock` (o `mock` só ecoa o texto — serve para rodar sem gastar). |
| `YTDLP_PATH` | Opcional. Caminho do `yt-dlp`; vazio significa procurar no `PATH`. |

**A chave nunca vai para o navegador.** Ela é lida apenas em código de servidor; o cliente recebe só um "sim/não" dizendo se a tradução está configurada.

### Detecção automática de legenda (opcional)

Se você tiver o [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) instalado, a opção "Detectar automaticamente" aparece ao adicionar um vídeo. Ela usa o programa **na sua máquina** para baixar a legenda publicada pelo próprio vídeo — preferindo a oficial e caindo para a automática só quando não há outra. Sem o `yt-dlp`, a opção some e o caminho manual continua sendo o principal.

Se der erro de "conteúdo não disponível", provavelmente sua versão está velha: `yt-dlp -U`.

---

## Levando os flashcards para o Anki

Dois caminhos, e os dois existem porque servem a momentos diferentes:

**Um card por vez** — na página Flashcards, `Copiar Original` → cole na frente; `Copiar Tradução` → cole no verso. Ou `Frente + verso`, que copia `Original⇥Tradução` de uma vez.

**Em lote** — selecione os cards (ou não selecione nenhum, para exportar o que está filtrado) e baixe em **TSV**. No Anki: *Arquivo → Importar*, escolha o arquivo, e mapeie as colunas:

| Coluna | Conteúdo |
|---|---|
| 1 | Frente (idioma original) |
| 2 | Verso (português) |
| 3 | Vídeo de origem |
| 4 | Timestamp |

O TSV é o formato recomendado; o CSV existe para abrir em planilha.

---

## Atalhos

Na tela de estudo, com o foco fora de campos de texto. Pressione `?` para ver esta lista dentro do app.

| Tecla | Ação |
|---|---|
| `Espaço` | Reproduzir ou pausar |
| `←` / `→` | Voltar / avançar 5 segundos |
| `↑` / `↓` | Frase anterior / próxima |
| `R` | Repetir a frase atual em loop |
| `A` | Marcar início e fim de um trecho para repetir |
| `F` | Criar flashcard da seleção ou da frase atual |
| `Esc` | Cancelar seleção ou parar a repetição |
| `?` | Mostrar os atalhos |

---

## Comandos

```bash
npm run dev         # desenvolvimento
npm run build       # build de produção
npm start           # roda o build
npm run typecheck   # TypeScript
npm test            # Vitest
npm run db:studio   # inspecionar o banco
npm run db:seed     # repovoar o exemplo
```

---

## Como está organizado

```
app/          rotas e API routes (Next.js App Router)
components/   video, subtitles, highlights, flashcards, library, ui
services/     translation, subtitles (parsers e yt-dlp), export, library, study, flashcards, highlights
lib/          stores, seleção, sincronia, atalhos, utilitários
prisma/       schema, migrations, seed
tests/        Vitest — 151 testes
```

**Stack:** Next.js 16 + React 19 + TypeScript strict, Tailwind v4, SQLite via Prisma 7, Zod, Zustand, TanStack Virtual, SDK da Anthropic.

Algumas decisões que explicam o código:

- **O tempo do vídeo não passa por estado do React.** Ele vive num store externo, e só o índice da frase ativa é publicado — sem isso, a tela repintaria dez vezes por segundo.
- **A transcrição é virtualizada.** Um vídeo de uma hora passa de mil blocos.
- **Não inventamos correspondência palavra a palavra** entre original e tradução. Ela não existe de forma confiável, então a seleção é exata de um lado e o outro lado destaca a frase inteira.
- **Falha de tradução é parcial, nunca total.** O bloco que falhou fica marcado e os outros continuam; há um botão para tentar de novo só o que faltou.
- **Toda tradução é cacheada** por texto, idioma, provedor e modelo — o mesmo trecho nunca é pago duas vezes, nem entre vídeos diferentes.

---

## O que está preparado para depois

O modelo de dados e as interfaces já acomodam, sem reescrita: autenticação e vários usuários, decks e tags, exportação por AnkiConnect ou `.apkg`, outros provedores de tradução, vídeos locais e áudio/podcast, e um sistema próprio de repetição espaçada.

---

## Limitações conhecidas

- **Um usuário, uma máquina.** Não há login nem sincronização entre dispositivos; o banco é um arquivo local.
- **Só YouTube** como fonte de vídeo por enquanto.
- Vídeos cujo dono **bloqueia reprodução fora do YouTube** não tocam aqui — o app avisa e oferece o link.
- A **legenda automática** do YouTube não tem pontuação confiável, o que atrapalha leitura e tradução. Quando houver legenda oficial, ela é preferida.
- Transcrição colada **sem marcas de tempo** recebe tempos estimados; o app avisa que a sincronia é aproximada.
