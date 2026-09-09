# CONTEXTO E OBJETIVO

Quero que você atue como um **Senior Full-Stack Engineer, Software Architect e Product Designer** e construa uma aplicação web completa para aprendizado de inglês através de vídeos.

A aplicação nasce de um método que já funcionou para mim:

1. assistir a vídeos em inglês;
2. acompanhar a legenda original;
3. consultar a tradução;
4. repetir trechos várias vezes;
5. selecionar frases interessantes;
6. transformar essas frases em flashcards;
7. estudar posteriormente no Anki.

Quero transformar esse processo manual em uma experiência extremamente fluida.

O princípio central do produto é:

**Vídeo → legenda original → tradução → seleção → flashcard → Anki**

A aplicação deve reduzir ao máximo o número de cliques entre assistir a uma frase interessante e transformá-la em um flashcard.

---

# 1. VISÃO DO PRODUTO

Construa uma aplicação web moderna, simples e intuitiva onde o usuário possa adicionar um vídeo e estudar o conteúdo através de legendas sincronizadas.

A interface principal deve apresentar:

* player de vídeo;
* legenda no idioma original;
* tradução logo abaixo;
* sincronização das legendas com o vídeo;
* possibilidade de clicar em uma legenda para ir diretamente para aquele momento do vídeo;
* possibilidade de selecionar/marcar uma frase ou trecho;
* destaque simultâneo do trecho correspondente no original e na tradução;
* criação rápida de flashcards;
* área específica para revisar os flashcards criados;
* fluxo extremamente rápido para copiar o conteúdo para o Anki.

O produto deve parecer uma ferramenta de estudo profissional, e não um projeto experimental.

---

# 2. EXPERIÊNCIA PRINCIPAL

Imagine esta estrutura:

[ PLAYER DE VÍDEO ]

Original:
I have been studying English for three years.

Tradução:
Eu estudo inglês há três anos.

O usuário deve conseguir selecionar uma frase ou trecho.

Quando selecionar o texto original, o trecho correspondente da tradução também deve ficar destacado.

O inverso também deve funcionar quando tecnicamente possível.

O usuário poderá então clicar em algo como:

"Adicionar ao Flashcard"

Esse flashcard deve guardar:

* texto original;
* tradução;
* timestamp inicial;
* timestamp final;
* referência ao vídeo;
* contexto da legenda;
* data de criação.

Exemplo:

FRONT
I have been studying English for three years.

BACK
Eu estudo inglês há três anos.

---

# 3. PLAYER E REPETIÇÃO

O player é parte fundamental da experiência.

Implementar:

* play/pause;
* controle de velocidade;
* avançar/retroceder;
* clicar na legenda para navegar para aquele timestamp;
* destacar automaticamente a legenda atual;
* auto-scroll opcional das legendas;
* repetir legenda atual;
* repetir trecho selecionado;
* loop A-B.

Quero poder ouvir a mesma frase diversas vezes facilmente.

Exemplo:

[ ↻ Repetir frase ]

Ao ativar, aquele segmento deve tocar novamente até eu desativar o loop ou avançar para outra legenda.

Atalhos de teclado são desejáveis para tornar o estudo rápido.

---

# 4. LEGENDAS

A aplicação deve trabalhar inicialmente com inglês como idioma original, mas a arquitetura deve permitir outros idiomas posteriormente.

Suportar formatos comuns de legenda, principalmente:

* SRT;
* VTT.

Investigue também a melhor abordagem tecnicamente e legalmente adequada para trabalhar com legendas de vídeos do YouTube.

Não construa uma solução baseada em scraping frágil ou violação dos termos da plataforma.

Caso a legenda não possa ser obtida automaticamente, permita que o usuário:

* importe SRT;
* importe VTT;
* cole uma transcrição;
* associe a transcrição ao vídeo.

Internamente, normalize as legendas para uma estrutura semelhante a:

{
id,
startTime,
endTime,
originalText,
translatedText
}

---

# 5. TRADUÇÃO

Quero que você tome uma decisão arquitetural consciente sobre tradução.

Compare alternativas como:

* APIs de tradução tradicionais;
* DeepL;
* Google Cloud Translation;
* modelos de IA/LLMs;
* OpenAI;
* Anthropic;
* outras soluções adequadas.

Considere:

* qualidade;
* tradução contextual;
* custo;
* velocidade;
* rate limits;
* privacidade;
* facilidade de implementação.

Minha prioridade é que a tradução seja **natural e contextual**, porque a aplicação é destinada ao aprendizado de idiomas.

Evite simplesmente traduzir frases isoladas quando isso prejudicar o significado.

Uma possibilidade é enviar pequenos blocos de legendas adjacentes para a IA entender o contexto, mas manter o mapeamento entre cada segmento original e sua tradução.

Crie uma camada de abstração para tradução, por exemplo:

TranslationProvider

Assim poderemos trocar o provedor no futuro sem reescrever a aplicação.

As chaves de API devem existir somente no backend.

Nunca exponha API keys no frontend.

Implemente cache das traduções para evitar pagar repetidamente pela tradução do mesmo conteúdo.

---

# 6. SELEÇÃO E DESTAQUE DE TEXTO

Esta é uma funcionalidade central.

O usuário deve conseguir selecionar:

* uma legenda inteira;
* uma frase;
* algumas palavras dentro da legenda;
* eventualmente um trecho envolvendo legendas adjacentes.

A seleção deve produzir um objeto persistente contendo informações suficientes para reconstruir o destaque posteriormente.

Ao marcar o original, a tradução correspondente também deve aparecer destacada visualmente.

Como tradução não possui necessariamente correspondência palavra por palavra, não assuma alinhamento perfeito entre palavras.

Projete uma solução robusta.

Na primeira versão, se não houver alinhamento semântico palavra-a-palavra confiável, destaque o segmento traduzido correspondente inteiro enquanto preserva exatamente a seleção feita no texto original.

Não invente correspondência entre palavras quando ela não existir.

---

# 7. FLASHCARDS

Criar uma área chamada, por exemplo:

"Flashcards"

Cada seleção feita durante o estudo poderá virar um flashcard.

Mostrar:

Original
I have been studying English for three years.

Tradução
Eu estudo inglês há três anos.

Contexto
I've recently moved to London. I have been studying English for three years...

Timestamp
02:14

Ações:

[ Copiar Original ]
[ Copiar Tradução ]
[ Copiar Frente + Verso ]
[ Ir para o vídeo ]
[ Editar ]
[ Excluir ]

O fluxo para Anki deve ser extremamente eficiente.

Idealmente:

1. clicar em "Copiar Original";
2. conteúdo já está no clipboard;
3. colar no Front do Anki;
4. clicar em "Copiar Tradução";
5. colar no Back.

Também quero um botão:

"Copiar Flashcard"

que copie em formato previsível:

Original[TAB]Tradução

Isso facilita importações.

---

# 8. EXPORTAÇÃO PARA ANKI

Além da cópia rápida, implementar exportação em lote.

Inicialmente suportar:

* TSV;
* CSV.

Estrutura sugerida:

Front | Back | Source | Timestamp

Exemplo:

I have been studying English for three years. | Eu estudo inglês há três anos. | Nome do vídeo | 02:14

Prepare a arquitetura para uma futura integração com:

* AnkiConnect;
* geração de pacotes;
* outros sistemas de spaced repetition.

Não precisamos necessariamente implementar integrações complexas se elas tornarem a primeira versão instável, mas a arquitetura não deve impedir isso posteriormente.

---

# 9. BIBLIOTECA

Criar uma página inicial/biblioteca mostrando os vídeos adicionados.

Cada vídeo deve ter:

* título;
* thumbnail quando disponível;
* idioma;
* duração;
* progresso;
* quantidade de flashcards;
* última vez estudado.

Exemplo:

Continue estudando

[ Thumbnail ]
How I Learned English
32 min
42% concluído
18 flashcards

---

# 10. PERSISTÊNCIA

Não quero perder:

* vídeos;
* legendas;
* traduções;
* marcações;
* flashcards;
* progresso;
* configurações.

Modele adequadamente o banco de dados.

Entidades provavelmente necessárias:

User
Video
SubtitleTrack
SubtitleSegment
Translation
Highlight
Flashcard
StudyProgress

Ajuste esse modelo se encontrar uma arquitetura melhor.

---

# 11. DESIGN

O design deve ser extremamente simples.

Referências conceituais:

* Linear;
* Notion;
* Readwise Reader;
* interfaces modernas de ferramentas de produtividade.

Não copie nenhuma delas literalmente.

Quero:

* pouco ruído visual;
* excelente tipografia;
* bastante espaço;
* hierarquia visual clara;
* foco no vídeo e no conteúdo;
* poucas cores;
* responsividade;
* dark mode;
* feedback visual imediato.

Evite:

* gradientes desnecessários;
* excesso de cards;
* menus gigantes;
* animações sem função;
* visual genérico de "dashboard SaaS";
* ícones desnecessários;
* telas lotadas.

A aplicação deve ser compreensível sem tutorial.

---

# 12. LAYOUT DA TELA DE ESTUDO

Desktop:

┌───────────────────────────────────────────────┐
│ ← Biblioteca       Nome do vídeo             │
├───────────────────────┬───────────────────────┤
│                       │                       │
│       VÍDEO           │      TRANSCRIÇÃO     │
│                       │                       │
│                       │ Original              │
│                       │ Translation           │
│                       │                       │
│                       │ Original              │
│                       │ Translation           │
│                       │                       │
├───────────────────────┴───────────────────────┤
│ Flashcards / seleção atual                    │
└───────────────────────────────────────────────┘

Você pode alterar esse layout se encontrar uma solução de UX superior.

Em telas menores, adaptar adequadamente.

---

# 13. DETALHES IMPORTANTES DE UX

Quando a legenda correspondente ao momento atual estiver ativa:

* destacar discretamente;
* mantê-la visível;
* permitir clicar nela;
* não fazer scroll agressivo enquanto o usuário estiver lendo outra parte.

Ao passar o mouse sobre uma legenda, disponibilizar ações rápidas.

Exemplo:

▶  ↻  ★

Onde:

▶ = tocar trecho
↻ = repetir
★ = criar flashcard/marcar

Utilize tooltips.

---

# 14. ATALHOS

Crie atalhos úteis, evitando conflito com navegador/sistema.

Sugestões:

Space = play/pause
← / → = navegar
R = repetir frase
F = criar flashcard da seleção
Esc = cancelar seleção

Defina os atalhos finais com base em boa UX.

Inclua uma pequena tela/modal mostrando os atalhos.

---

# 15. TECNOLOGIA

Antes de implementar, escolha uma stack moderna, estável e simples de manter.

Uma possibilidade:

Frontend:

* Next.js;
* React;
* TypeScript;
* Tailwind CSS.

Backend:

* Next.js server-side/API routes ou arquitetura equivalente.

Banco:

* PostgreSQL.

ORM:

* Prisma ou alternativa apropriada.

Validação:

* Zod.

Você pode mudar essas escolhas se houver justificativa técnica clara.

Não escolha tecnologias simplesmente porque estão na moda.

Priorize:

* manutenção;
* performance;
* segurança;
* simplicidade;
* experiência do desenvolvedor.

---

# 16. ARQUITETURA

Não coloque toda a aplicação em componentes gigantes.

Separe responsabilidades.

Exemplo conceitual:

/components
/video
/subtitles
/highlights
/flashcards
/library

/services
/translation
/subtitles
/export

/lib

/database

Implemente tipos fortes em TypeScript.

Crie abstrações para integrações externas.

---

# 17. SEGURANÇA

Implementar boas práticas desde o começo.

Principalmente:

* API keys somente no servidor;
* variáveis de ambiente;
* validação de inputs;
* sanitização;
* proteção contra uploads maliciosos;
* limites de tamanho;
* tratamento seguro de URLs;
* rate limiting nas chamadas caras quando necessário;
* nenhuma chave secreta enviada ao navegador.

Criar `.env.example`.

Nunca colocar credenciais reais no código.

---

# 18. ESTADOS E ERROS

Trate adequadamente:

* vídeo sem legenda;
* legenda inválida;
* falha na tradução;
* tradução parcial;
* API indisponível;
* vídeo indisponível;
* erro de rede;
* nenhum flashcard;
* biblioteca vazia;
* carregamento;
* tradução em andamento.

Não deixe simplesmente erros aparecerem no console.

Mostre mensagens compreensíveis para o usuário.

---

# 19. PERFORMANCE

Um vídeo pode possuir milhares de segmentos de legenda.

Não crie uma implementação que renderize ou processe tudo de maneira ineficiente.

Considere:

* virtualização;
* cache;
* processamento em lote;
* debounce quando necessário;
* índices no banco;
* lazy loading.

A sincronização do vídeo não deve causar re-renderização desnecessária da aplicação inteira várias vezes por segundo.

---

# 20. TESTES

Adicionar testes principalmente para as partes críticas:

* parser SRT;
* parser VTT;
* sincronização timestamp → legenda;
* seleção;
* criação de flashcard;
* exportação;
* serviço de tradução.

Não priorize testes superficiais em detrimento das funcionalidades.

---

# 21. PRIMEIRA EXPERIÊNCIA

Quando o usuário abrir a aplicação pela primeira vez:

Mostrar algo simples como:

"Aprenda inglês com os vídeos que você realmente quer assistir."

[ Adicionar vídeo ]

Depois:

Adicionar vídeo

URL do vídeo
[____________________________]

Legenda:
○ Detectar quando possível
○ Importar arquivo
○ Colar transcrição

Idioma original:
English

Tradução:
Português (Brasil)

[ Criar sessão de estudo ]

A experiência deve ser rápida.

---

# 22. DECISÕES QUE VOCÊ DEVE TOMAR

Não quero que você simplesmente implemente cegamente minhas sugestões.

Você é responsável pela arquitetura.

Antes de desenvolver:

1. analise os requisitos;
2. identifique riscos técnicos;
3. identifique funcionalidades que dependem de APIs externas;
4. identifique limitações relacionadas ao YouTube;
5. escolha a arquitetura;
6. escolha a estratégia de tradução;
7. defina o modelo de dados;
8. defina os principais fluxos de UX.

Quando houver uma escolha entre uma implementação sofisticada e frágil ou uma implementação simples e confiável, prefira a confiável.

---

# 23. IMPORTANTE: NÃO QUERO APENAS UM MOCKUP

Não construa uma tela bonita com dados falsos e considere o projeto terminado.

Quero funcionalidades reais.

O objetivo é que seja possível:

Adicionar vídeo
↓
Adicionar/obter legenda
↓
Traduzir
↓
Assistir sincronizado
↓
Selecionar texto
↓
Criar flashcard
↓
Copiar/exportar para Anki
↓
Fechar a aplicação
↓
Abrir novamente
↓
Continuar exatamente de onde estava

Esse é o fluxo mínimo que define se o produto funciona.

---

# 24. DESENVOLVIMENTO

Trabalhe de forma incremental.

Primeiro:

* inspecione o ambiente/repositório existente;
* não sobrescreva código importante sem necessidade;
* explique brevemente a arquitetura escolhida;
* crie o banco/modelos necessários;
* implemente o fluxo principal de ponta a ponta;
* depois refine UX e funcionalidades secundárias.

Não fique apenas escrevendo um plano.

Depois de planejar, implemente.

Durante o desenvolvimento:

* execute a aplicação;
* execute testes;
* verifique erros;
* corrija-os;
* teste o fluxo principal;
* revise a interface.

Não considere o trabalho concluído simplesmente porque o código compilou.

---

# 25. CRITÉRIO DE CONCLUSÃO

Antes de finalizar, valide manualmente o seguinte cenário:

1. adiciono um vídeo;
2. adiciono uma legenda;
3. a legenda aparece sincronizada;
4. vejo original + português;
5. clico em uma legenda e o vídeo vai até ela;
6. consigo repetir a frase;
7. seleciono/marco uma frase;
8. original e tradução ficam relacionados;
9. transformo a seleção em flashcard;
10. vejo o flashcard na área correspondente;
11. copio original com um clique;
12. copio tradução com um clique;
13. exporto vários flashcards;
14. recarrego a página;
15. meus dados continuam salvos.

Se algum desses pontos não funcionar, continue trabalhando antes de considerar a implementação concluída.

---

# 26. PREPARAÇÃO PARA EVOLUÇÃO

Mesmo entregando uma versão completa desde o início, prepare a arquitetura para funcionalidades futuras como:

* autenticação;
* sincronização entre dispositivos;
* decks;
* tags;
* dicionário;
* pronúncia;
* text-to-speech;
* explicação gramatical com IA;
* definição de palavras;
* geração automática de flashcards;
* dificuldade das frases;
* histórico de estudo;
* spaced repetition próprio;
* AnkiConnect;
* Netflix/outros provedores;
* vídeos locais;
* áudio;
* podcasts.

Não implemente funcionalidades futuras desnecessariamente agora.

Apenas evite decisões arquiteturais que tornem essas evoluções difíceis.

---

# RESULTADO ESPERADO

Quero terminar esta execução com uma aplicação realmente utilizável, não somente uma demonstração.

A prioridade é:

1. fluxo de estudo excelente;
2. sincronização vídeo/legenda confiável;
3. tradução de boa qualidade;
4. criação de flashcards extremamente rápida;
5. persistência;
6. interface simples;
7. arquitetura sustentável.

Comece analisando o repositório e o ambiente atual. Depois apresente de forma breve as decisões arquiteturais mais importantes e prossiga com a implementação.

Quando precisar escolher entre me fazer uma pergunta técnica ou tomar uma decisão razoável e reversível, prefira tomar a decisão e continuar.

Só me interrompa quando realmente precisar de uma informação, credencial ou decisão que impeça o avanço.


# IDIOMAS SUPORTADOS

Nesta primeira versão, quero suportar apenas três idiomas de origem:

* Inglês
* Francês
* Espanhol

O idioma de tradução será inicialmente:

* Português do Brasil

A arquitetura deve permitir adicionar outros idiomas futuramente, mas não quero aumentar desnecessariamente a complexidade agora.

O usuário deverá escolher o idioma original ao adicionar o vídeo:

Idioma original:

○ English
○ Français
○ Español

Traduzir para:

Português (Brasil)

O sistema deve armazenar o idioma de cada vídeo e de sua respectiva faixa de legenda.

---

# NAVEGAÇÃO PELO VÍDEO ATRAVÉS DA LEGENDA

Esta funcionalidade é muito importante para a experiência de estudo.

Cada segmento da legenda deve estar associado ao seu timestamp no vídeo.

Estrutura conceitual:

{
id,
startTime,
endTime,
originalText,
translatedText
}

Quando o usuário clicar em uma frase da legenda original ou em sua tradução, o player deve navegar automaticamente para o início daquele trecho.

Exemplo:

Vídeo está em:

08:42

O usuário encontra uma frase anterior:

"I didn't know what to expect."

Timestamp:

03:17

Ao clicar nessa frase:

→ o vídeo vai automaticamente para 03:17
→ a frase passa a ser a legenda ativa
→ o usuário pode apertar play e ouvir novamente

Não quero que seja necessário procurar manualmente o trecho na barra do vídeo.

---

# COMPORTAMENTO DA LEGENDA

Cada bloco deve funcionar aproximadamente assim:

03:17

I didn't know what to expect.

Eu não sabia o que esperar.

Ao passar o mouse:

[ ▶ Reproduzir ] [ ↻ Repetir ] [ ★ Flashcard ]

Também deve ser possível simplesmente clicar no bloco da legenda para navegar até aquele ponto.

O clique no texto não deve interferir com a seleção de texto.

Portanto:

* clique simples fora de uma seleção → navegar até o timestamp;
* seleção de texto → permitir destacar/criar flashcard;
* botão ▶ → navegar até o timestamp e reproduzir;
* botão ↻ → reproduzir aquele trecho em loop.

Projete cuidadosamente esses eventos para que selecionar texto e clicar na legenda não entrem em conflito.

---

# LEGENDA ATIVA

Enquanto o vídeo estiver tocando, identificar automaticamente qual segmento corresponde ao timestamp atual.

Esse segmento deve:

* receber destaque visual discreto;
* permanecer facilmente visível;
* acompanhar o vídeo;
* não causar scroll agressivo.

Se o usuário estiver navegando manualmente pela transcrição, não force automaticamente a tela de volta para a legenda atual.

Pode existir uma opção:

[ ✓ Acompanhar vídeo ]

Quando ativada, a transcrição acompanha automaticamente a reprodução.

---

# REPETIÇÃO

Uma das partes mais importantes do aprendizado é conseguir ouvir a mesma frase diversas vezes.

Cada segmento possui:

startTime
endTime

Portanto implemente:

[ ↻ Repetir frase ]

Enquanto estiver ativo:

1. reproduzir a partir de `startTime`;
2. quando chegar a `endTime`, voltar para `startTime`;
3. continuar até o usuário desativar o loop ou selecionar outra legenda.

Isso deve funcionar para inglês, francês e espanhol da mesma maneira.

---

# PRIORIDADE DE IMPLEMENTAÇÃO

Considere as funcionalidades nesta ordem de importância:

1. adicionar vídeo;
2. adicionar/importar legenda;
3. selecionar idioma original entre inglês, francês e espanhol;
4. gerar tradução para português;
5. sincronizar legenda e vídeo;
6. clicar em qualquer frase para navegar até aquele ponto do vídeo;
7. repetir aquela frase;
8. selecionar trechos;
9. relacionar original e tradução;
10. criar flashcard;
11. copiar rapidamente para o Anki;
12. exportar flashcards;
13. persistir progresso e dados.

A funcionalidade de clicar na frase e navegar para o timestamp deve ser implementada se o player utilizado permitir controle programático de tempo de reprodução.

Como os segmentos de legenda já possuem timestamps, essa funcionalidade deve ser considerada relativamente simples e deve fazer parte do MVP.

Somente abandone essa funcionalidade se existir uma limitação concreta da plataforma/player utilizado.

Nesse caso:

1. documente exatamente qual é a limitação;
2. não crie hacks frágeis;
3. mantenha os timestamps armazenados;
4. prepare a arquitetura para adicionar a funcionalidade posteriormente.

---

# CRITÉRIO DE VALIDAÇÃO ADICIONAL

Antes de considerar o produto pronto, valide também este fluxo:

1. abro um vídeo;
2. o vídeo está, por exemplo, em 10:35;
3. navego pela transcrição;
4. encontro uma frase em 04:22;
5. clico nessa frase;
6. o player vai imediatamente para aproximadamente 04:22;
7. clico em reproduzir;
8. ouço aquela frase;
9. clico em repetir;
10. o trecho fica em loop;
11. paro o loop;
12. seleciono a frase;
13. transformo em flashcard.

Esse fluxo deve funcionar igualmente para:

* inglês → português;
* francês → português;
* espanhol → português.
