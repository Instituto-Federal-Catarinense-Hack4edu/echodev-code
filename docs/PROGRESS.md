# Progresso

## Base do produto (fases 0 a 5)
- `web/`: Next.js 16 (App Router, TypeScript estrito), Tailwind 4, shadcn/ui, Zod 4, Vitest. `api/`: Python 3.12, FastAPI, Pydantic v2. Banco e login no **Firebase** (seção "Migração para o Firebase").
- **Dicionário** `programacao-geral.json` com 40 termos, 3 profundidades em pt e es. **Todos `reviewed: false`.** Corretor de termos no navegador do professor (1 a 3 palavras, correção aproximada com proteções contra palavras do português) e filtro de palavrões antes de publicar.
- **Reconhecimento de fala** atrás de `SttProvider`: `WebSpeechProvider` (reinício automático, limite de erros, erros de permissão claros) e `FakeSttProvider` (aula de demonstração).
- **Legenda ao vivo**: frases numeradas por `seq`, recuperação de lacunas ao reconectar, legenda grande com controle de fonte, "Voltar ao vivo (N novas)", explicação do termo em 3 profundidades, tela acesa (wake lock), painel `?debug=1`. Modo demonstração em `/demo/professor` e `/demo/estudante` (sem login, entre abas do mesmo navegador).
- **Aula real**: professor cria a aula (código de 6 caracteres, QR code), aluno entra pelo código depois dos consentimentos (um por tela, nada pré-marcado), contador de alunos, `seq` que continua depois de recarregar.
- **Fim da aula**: a API encerra, guarda o relatório (sem texto) e gera rascunhos de resumo e quiz com IA (`mock`, `gemini` ou `anthropic`; validação com uma nova tentativa; textos longos divididos em blocos). O professor revisa, edita e aprova; o aluno recebe o botão **Ver resumo e quiz** e o PDF.
- **Nível 2**: preferências no perfil, toques e "Ajudou / Não ajudou / Ainda tenho dúvida" com pseudônimo, correção de termo pelo professor durante a aula, relatório agregado (mínimo de 3 alunos), `/conta` com consentimentos e "Excluir meus dados".
- **Acessibilidade**: foco visível, alvos de toque de 44 px, `aria-live` na legenda, `prefers-reduced-motion`. PWA só com manifest e ícones.

## O que NÃO foi testado em condições reais
- **Microfone de verdade em sala de aula** (Web Speech API com ruído, eco, sotaques).
- **Celulares reais** (Android e iOS/Safari), inclusive wake lock e troca de rede 4G/Wi-Fi.
- **Carga no Firestore**: `npm run load:test` ainda não foi rodado contra o projeto Firebase.
- **API hospedada** (cold start, limites de tempo): só rodou localmente.
- **Provedor `anthropic` com chamada real** (sem `ANTHROPIC_API_KEY`).

## Papéis e painel da aula (04/11/2026)
- Professor e aluno separados nas regras, nas rotas e no menu; área do aluno em `/aluno`; painel da aula após encerrar (PDF, conferir quiz, relatório); termo clicável no console do professor.

## Espanhol (05/11/2026)
- Legenda traduzida ao vivo (Chrome do professor), telas do aluno, explicações completas dos 40 termos, resumo, quiz e PDF em espanhol.
- Para traduzir, o professor usa o Google Chrome 138+ no computador; desde a fase 10 é o aluno quem escolhe ver em espanhol.

## Redesenho de UI/UX (05/11/2026)
- Todas as telas redesenhadas sem mudar funcionalidades: página inicial (com prévia interativa de termo), login, demonstrações, console do professor, legenda do aluno, explicação do termo, minhas aulas, nova aula, aula ao vivo, painel, relatório (gráfico de ritmo), revisão do resumo e quiz, quiz, área do aluno, consentimentos, minha conta e 404.
- Modo escuro (segue o sistema, com botão de sol/lua), botões e campos maiores, avisos coloridos com ícone, estados de carregamento e vazio.
- Novos recursos de UX: mostrar senha, copiar código/link, filtro de aulas por status, contadores de caracteres, contagem do teste de microfone, guia de 3 passos na demonstração.
- Corrigido: a legenda abria no menor tamanho de letra na primeira visita.
- Tiradas da interface as menções à "demonstração offline" (seção da página inicial, atalhos no login, textos "sem login"). As páginas `/demo/professor` (agora "Painel do professor") e `/demo/estudante` ("Legenda ao vivo") continuam abrindo pelo endereço; o botão "Usar aula de demonstração" do console continua, por ser um recurso.
- Tirados os selos de privacidade da página inicial e a linha de privacidade do rodapé (pedido do usuário). As mesmas informações seguem nos textos de consentimento e no aviso do relatório.
- Verificado no navegador (claro e escuro, computador e celular): demonstração professor → estudante, abrir termo, quiz, relatório e editores com dados de exemplo.

## Migração para o Firebase (05/11/2026, branch `firebase`)
- Login no Firebase Authentication (e-mail/senha com confirmação, Google opcional, redefinição de senha), banco no Cloud Firestore, regras em `firestore.rules`, índices em `firestore.indexes.json`, emuladores em `firebase.json`. Projeto: `echodev-eb4fb`.
- **Ao vivo**: o professor grava cada frase em `lessons/{id}/utterances` e os alunos recebem por listener do Firestore (`FirestoreTransport`, mesmo contrato `RealtimeTransport`). "Aula encerrada" chega pelo status da aula.
- **API Python** com `firebase-admin`: valida o ID token; novas rotas `POST /me/profile` (cria o perfil com o papel da `teacherAllowlist`), `POST /lessons/join`, `GET /lessons/{id}/member-count`, `GET /lessons/{id}/term-report` (mínimo de 3 alunos); `end`, `regenerate`, `DELETE /me` e `/cron/purge` adaptadas. 57 testes `pytest` com um Firestore falso em memória.
- **Regras provadas no emulador**: `npm run test:rules`, 15 grupos de casos (substitui o `check:rls`).
- **Scripts**: `seed:dev`, `teacher:add` e `load:test` usam o Admin SDK (`--emulators` para rodar local); `npm run dev:emulators` sobe tudo sem tocar no projeto real.
- `npm run check` verde. Verificado no emulador: as regras (15 grupos) e a criação dos 9 usuários de teste. **O fluxo completo no navegador (criar aula, aluno entrar, legenda, encerrar, aprovar, quiz) ficou para o teste manual da equipe.**
- **Ação manual**: seguir `docs/SETUP_MANUAL.md` (ativar e-mail/senha, criar o Firestore, gerar a chave da conta de serviço, `firebase login`, `npm run deploy:rules`).

## Escolha de papel no login (05/11/2026)
- Tela de entrar/criar conta com "Aluno / Professor". Escolher "Professor" com e-mail fora da `teacherAllowlist` mostra "Este e-mail não está autorizado como professor" e sai da sessão, sem criar perfil de aluno. `POST /me/profile` aceita `intent` (opcional); 3 testes novos (60 no `pytest`). `npm run check` verde. **Não testado no navegador ainda.**

## Fase 6: IA gratuita com Gemini (05/11/2026)
- `LLM_PROVIDER=gemini` gera resumo e quiz com o Gemini (`api/app/llm/gemini_provider.py`); chave gratuita do AI Studio, sem cartão (passo a passo em `docs/SETUP_MANUAL.md`, seção 8). Cota esgotada no modelo principal passa sozinha para o modelo reserva.
- 17 testes novos com um cliente falso do SDK (sem rede): esquema e modo JSON enviados, troca de modelo na cota e na sobrecarga, erros de chave/modelo/limite de tokens/recusa/rede, fluxo completo de materiais.
- `npm run check` verde. **Não testado com chamada real** (sem `GEMINI_API_KEY` nesta máquina).

## Fase 7: termos técnicos mantidos na tradução para o espanhol (05/11/2026)
- Na legenda traduzida e no resumo e quiz em espanhol, jargão como `commit`, `push`, `merge`, `pull request` e `useState` fica como foi dito; variável, função, classe etc. continuam traduzidos (`web/src/lib/translate/keep-terms.ts`).
- 9 testes novos com um tradutor falso que imita o Chrome (inclusive perdendo as marcas, para o plano B). `npm run check` verde. **Não testado no Chrome de verdade**: o comportamento das marcas no tradutor real precisa ser conferido numa aula de teste (se ele perder as marcas, o plano B entra sozinho).

## Fase 8: glossário da aula feito pela IA (05/11/2026)
- A IA lista os termos técnicos novos da aula (além do dicionário) com explicações em português e espanhol; o professor revisa e aprova em "Revisar materiais" (editor com nome, nome em espanhol, explicações, exemplos, passos e variações). O aluno vê o glossário aprovado na revisão da aula e no PDF; o painel da aula mostra o estado do glossário.
- API: `glossario` no esquema, no prompt e no `mock`; `known_terms` opcional em `end`/`regenerate`; 6 testes novos (83 no `pytest`). Web: 1 teste novo do PDF. `npm run check` verde.
- **Regras do Firestore mudaram** (`glossario` é um tipo de material permitido): rode `npm run deploy:rules` para enviar ao projeto. O caso novo em `web/rules-tests/` **não foi rodado** nesta máquina (os emuladores precisam do Java).
- **Não testado no navegador nem com o Gemini de verdade.**

## Fase 9: dicionário que cresce com os glossários aprovados (05/11/2026)
- Ao aprovar o glossário, os termos entram na coleção `glossaryTerms` e passam a ser destacados, corrigidos e explicados em todas as próximas aulas (ficha do termo, legenda traduzida, correção de termo, relatório e PDF), sem chamar a IA durante a aula.
- `web/src/lib/terms/ai-terms.ts` (conversão com as proteções do corretor, leitura e gravação) e registro de termos em `pack.ts`; 8 testes novos (112 no Vitest). `npm run check` verde.
- **Regras do Firestore mudaram de novo** (coleção `glossaryTerms`): rode `npm run deploy:rules`. Sem isso, aprovar o glossário mostra "não foi possível adicionar os termos ao dicionário" e a aula segue só com o pacote. O caso novo em `web/rules-tests/` não foi rodado (sem Java).
- **Não testado no navegador.**

## Fase 10: pronto para o piloto em sala (18/11/2026)
- **Next.js 16.4.4 → 16.4.6**: a 16.4.4 tem 2 falhas moderadas de vazamento no cache (GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8) e o `next build` passou a parar com erro por causa delas. Restam avisos do `npm audit` em `@grpc/grpc-js` (parte de servidor que o navegador não usa) e no `shadcn` (ferramenta de instalação de componentes), sem efeito na aula.
- **`npm run check` num clone novo**: o `typecheck` agora roda `next typegen` antes do `tsc` (sem isso, `LayoutProps` não existia e a checagem falhava).
- **Reconhecimento não para com a aba escondida**: depois de uma pausa normal o reconhecimento reinicia na hora (o Chrome atrasa timers de abas escondidas em até 1 min); ao voltar para a aba, um reinício pendente acontece na hora. 2 testes novos.
- **Tela do professor acesa** durante a aula ao vivo (Wake Lock).
- **Aluno decide o espanhol**: botão "Ver em espanhol" / "Ver em português" na barra da legenda. O professor não tem mais botão: o Chrome dele prepara o tradutor sozinho (ou no clique de "Iniciar transcrição", quando precisa baixar o pacote) e traduz todas as frases, mantendo os termos técnicos (fase 7).
- **Commit reconhecido** quando o Chrome escreve "comitê", "comite" ou "convite" (visto em teste real). "commitê" ficou de fora porque juntava "commit e" numa palavra só.
- **Dicionário**: explicação "Definição" com duas frases nos 40 termos; Git, repositório, commit, branch, merge, GitHub e push com definição longa e exemplo em bloco de código com explicação (pt e es). A aba "Curta" virou "Definição".
- **`npm run aula`**: gera a versão final e liga site + API, com a API servida pelo site em `/py` (um endereço só, bom para túnel); `API_PROXY_TARGET` em `next.config.ts`.
- **Gemini testado com chamada real**: resumo, quiz e glossário de 7 termos em pt/es em ~19 s.
- `npm run check` verde (115 Vitest, 83 pytest).

## Fase 11: pasta única no Firebase e fluxo completo testado (19/11/2026)
- Projeto só na versão Firebase, numa pasta só; versão antiga com Supabase descartada. `firebase-tools` 15.35.0 virou dependência de desenvolvimento.
- **`npm run test:rules`: 16/16** no emulador (inclui os casos do glossário que ainda não tinham rodado).
- **Fluxo completo no navegador com os emuladores** (`npm run dev:emulators`): professor entra → cria a aula → aluno (outra sessão) entra pelo código e aceita os consentimentos → aula de demonstração → legenda chega ao aluno com termos destacados e ficha do termo → encerrar → Gemini real gera resumo, quiz e glossário → professor aprova os três (1 termo novo entrou no dicionário) → aluno vê o aviso de fim de aula, o resumo, o quiz, o glossário e o botão do PDF.
- **Gemini mais resistente**: modelo principal `gemini-3.1-flash-lite`, reservas em lista (`gemini-3.5-flash-lite,gemini-3.6-flash`), troca de modelo também quando um demora demais, e segunda rodada depois de 3 s quando todos estão sobrecarregados. No teste, a primeira tentativa falhou com o 3.6-flash sobrecarregado; com a nova ordem, deu certo.
- Páginas do professor sem os erros de "instant navigation" do Next 16.4.6 em desenvolvimento; `dev:emulators` não cai mais no Windows quando a API muda.
- Tela de consentimento sem o aviso para menores (piloto só com maiores de idade).
- `npm run check` verde (115 Vitest, 88 pytest).

## Fase 12: aula completa no Firebase de verdade (25/11/2026)
- Projeto `echodev-eb4fb` configurado: configuração web no `web/.env.local`, chave da conta de serviço em `api/`, regras e índices publicados (`npm run deploy:rules`), usuários de teste (`npm run seed:dev`) e o professor `vmcdm0902@gmail.com` na `teacherAllowlist`.
- Novo **`npm run e2e:lesson`**: com a API ligada, faz uma aula inteira no projeto real **pelas regras de acesso**, como o site (usuários de teste entram com token criado pela conta de serviço, sem senha), e apaga tudo no fim. Resultado em 25/11: **15/15** (criar aula com código reservado, lista "Minhas aulas" com o índice, consentimentos, entrar pelo código, contador de alunos, aula ao vivo, frases gravadas e lidas pelo aluno, aluno de fora recusado, encerrar com o Gemini em ~10 s, rascunho escondido do aluno, aprovação, aluno lê resumo e quiz).
- **Ainda não testado no projeto real**: login pelo navegador (só pelo emulador), celulares e microfone de verdade.

## Pendências para a equipe
- **Aprovar o uso do Gemini gratuito** com a instituição: no plano gratuito o Google pode usar a transcrição enviada para melhorar os produtos dele (no plano pago, não).
- **Revisão humana do conteúdo** dos 40 termos (explicações e traduções) antes da demo. Nada na interface diz "verificado".
- Variações fonéticas são hipóteses: validar no Teste A (`docs/TESTE_MANUAL.md`).
- **Textos de consentimento** são marcadores ("texto a ser aprovado pela instituição"). O piloto considera só alunos maiores de idade.
- **Publicar** seguindo `docs/DEPLOY.md` (Render para a API com o `render.yaml`, Vercel para o site, limpeza de 24 h pelo GitHub Actions).
- **Trocar a chave do Gemini** depois do hackathon (ela passou pelo chat durante o desenvolvimento) e apagar o projeto Supabase antigo no painel dele, se ainda existir.

### Termos propensos a falso positivo (curadoria)
Palavras comuns do português que também são termos: `objeto`, `classe`, `método`, `função`, `variável`, `parâmetro`, `biblioteca`, `repositório`, `algoritmo`. Outros riscos: `jason` (nome próprio) como variação de JSON; `repo`; `bug`/`merge` em conversa informal. `for` ficou de fora de propósito ("se ele **for**").

## Ideias fora do escopo
- Ensinar ao corretor plurais automáticos (hoje são listados em `forms`).
- Painel de curadoria das correções de termos (`term_corrections`) para promovê-las ao pacote versionado.
- Curadoria dos termos aprovados da IA (`glossaryTerms`): editar ou remover um termo depois de aprovado.
