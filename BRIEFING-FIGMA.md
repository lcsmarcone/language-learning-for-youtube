# Briefing para protótipo

Aplicativo web para aprender idiomas assistindo vídeos do YouTube com legenda e
tradução. Uso pessoal, em desktop, sessões longas.

---

## O que o produto faz

A pessoa adiciona um vídeo do YouTube, traz a legenda no idioma original, e o
app traduz para português. Ela assiste com o texto sincronizado logo abaixo do
vídeo, repete as frases que quiser, marca os trechos interessantes e transforma
esses trechos em flashcards para estudar depois no Anki.

**O fluxo inteiro:** adicionar vídeo → legenda → tradução → assistir → marcar um
trecho → virar flashcard → copiar para o Anki.

Idiomas de origem: inglês, francês, espanhol. Tradução sempre para português do
Brasil.

---

## Quem usa

Uma pessoa sozinha, estudando por conta própria, normalmente à noite. Ela já
estuda por vídeo e quer parar de fazer isso à mão (pausar, copiar frase, colar
no tradutor, copiar de novo, colar no Anki). Não é iniciante em idioma nem em
computador.

**O que ela mais faz, em ordem:** ler a legenda enquanto assiste, reouvir a mesma
frase várias vezes, e marcar um trecho para virar card.

---

## Direção visual

Limpo e funcional, como o **freeCodeCamp** e o **Clozemaster**: fundo simples,
contraste alto, tipografia legível, pouca decoração. Nada de sombra, gradiente
ou card enfeitado. O que estiver na tela tem que ganhar o espaço que ocupa.

Precisa de **tema claro e tema escuro** — o app é muito usado à noite, com vídeo
na tela.

Poucas cores: uma cor de destaque só, usada para marcar texto, indicar a frase
que está tocando e o botão principal. O resto em neutros.

A tela é uma superfície de leitura. O texto do vídeo é o conteúdo principal, não
um detalhe da interface — merece tamanho e entrelinha confortáveis.

---

## Telas

### 1. Biblioteca (inicial)

Lista dos vídeos já adicionados, em grade.

Cada vídeo mostra: capa, título, idioma de origem, duração, quanto já foi
assistido, quantos flashcards saíram dali e se ainda falta traduzir. Um jeito de
remover o vídeo.

Tem um botão principal de **Adicionar vídeo**. A grade termina com um espaço
convidando a adicionar o próximo.

**Estado vazio:** primeira vez que abre, sem nenhum vídeo. Uma frase explicando o
que o app faz e um botão para começar.

### 2. Adicionar vídeo (janela sobre a biblioteca)

Formulário curto:

- Campo para colar o endereço do vídeo do YouTube. Ao colar, aparece uma prévia
  com capa, título e canal, para confirmar que é o vídeo certo.
- Escolha do idioma original: inglês, francês ou espanhol. Indicação de que a
  tradução é para português.
- Como trazer a legenda, com três opções: **detectar automaticamente**, **enviar
  arquivo** (.srt/.vtt) ou **colar a transcrição**. Cada opção mostra um controle
  diferente abaixo.
- Botão para criar.

Precisa de um estado de "buscando legenda" e de mensagens de erro no próprio
formulário.

### 3. Estudo — **a tela mais importante**

Estrutura de cima para baixo:

```
┌──────────────────────────────────────────────────┐
│ ← Biblioteca   Título do vídeo      inglês → pt  │
├──────────────────────────────────────────────────┤
│                                                   │
│              ┌──────────────────┐                 │
│              │      VÍDEO       │                 │
│              └──────────────────┘                 │
│         ▶  ↺  ↻  ⟳   02:14 / 14:30   velocidade  │
├──────────────────────────────────────────────────┤
│  405 frases                   ☑ Acompanhar vídeo │
├──────────────────────────────────────────────────┤
│                                                   │
│      00:01   Hey everyone, let's talk about       │
│              Oi gente, vamos falar sobre          │
│                                                   │
│      00:04   my low consumption habits            │
│              meus hábitos de baixo consumo        │
│                                                   │
│      00:08   and financial mindset tips.          │
│              e dicas de mentalidade financeira.   │
│                                                   │
├──────────────────────────────────────────────────┤
│  trecho selecionado    [Criar flashcard] [Marcar] │
└──────────────────────────────────────────────────┘
```

**O vídeo fica fixo no topo** e não sai da tela; só o texto rola. Ele não precisa
ser grande — o texto é que precisa de espaço.

**O texto vem embaixo, em coluna de leitura centralizada**, não em barra lateral
estreita. Cada bloco tem: o horário (fixo, à esquerda), a frase no idioma
original, e logo abaixo a tradução em português — uma mais discreta que a outra,
para não competirem.

Precisa dos seguintes estados de um bloco:

- **normal**
- **tocando agora** — a frase que corresponde ao momento do vídeo, destacada de
  forma discreta mas achável de relance
- **com o mouse em cima** — aparecem três ações pequenas à direita: tocar a
  partir daqui, repetir em loop, criar flashcard
- **com texto marcado** — um trecho com marcação de marca-texto
- **em loop** — indicando que aquela frase está se repetindo

**Interação central a representar:** ao selecionar um trecho no idioma original,
**a tradução correspondente fica destacada também** — e vice-versa. A seleção pode
atravessar várias frases seguidas, não só uma.

Quando há algo selecionado, **aparece uma barra no rodapé** mostrando o trecho nos
dois idiomas, com os botões de criar flashcard, marcar e cancelar.

Também precisa de:

- uma faixa avisando que a legenda ainda não foi traduzida, com botão para
  traduzir, e a versão dessa faixa com **barra de progresso** durante a tradução
- um botão para "voltar para a legenda atual", que aparece quando a pessoa rolou
  para longe
- uma janela listando os **atalhos de teclado**

### 4. Flashcards

Lista dos cards criados.

Cada card mostra: a frase no idioma original, a tradução, o contexto (a frase
anterior e a seguinte, mais apagadas), o idioma, o horário no vídeo e de qual
vídeo veio.

Ações em cada card: **copiar original**, **copiar tradução**, **copiar frente + verso**,
ir para o vídeo naquele ponto, editar e excluir. Os três botões de copiar são os
mais usados — o fluxo é copiar e colar no Anki, então eles ficam sempre visíveis.

Acima da lista: busca, filtro por vídeo, e seleção de vários cards para
**exportar em lote** (TSV/CSV).

Precisa de: **estado vazio**, card em **modo de edição**, e o aviso de "copiado" que
aparece depois de copiar.

---

## Estados que não podem faltar

Em qualquer tela, estes momentos precisam existir no protótipo:

- carregando
- lista vazia (biblioteca sem vídeos, nenhum flashcard)
- erro com mensagem clara e uma saída (ex.: vídeo que não pode ser reproduzido
  fora do YouTube, legenda inválida, tradução que falhou em alguns trechos)
- sem conexão

---

## Detalhes que importam para o protótipo

- O horário de cada frase é sempre visível — é por ele que a pessoa se localiza.
- Clicar numa frase leva o vídeo até ela. Vale representar esse "clicável".
- A tradução é visualmente secundária em relação ao idioma original, mas
  perfeitamente legível.
- O flashcard pode nascer de um trecho longo, com várias frases, não só de uma
  linha curta.
- Deve funcionar em tela de notebook (1280px) sem espremer o texto.
