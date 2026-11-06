# Progresso

## Fase 0: preparação (concluída)
- Next.js 16.4.4 em `web/` (TypeScript estrito, Tailwind 4, ESLint, App Router, `src/`), shadcn/ui (preset `base-nova`), `@supabase/ssr`, Zod 4, Vitest 5, `qrcode.react`, `openapi-typescript`.
- `api/` com venv Python 3.12, FastAPI, `GET /health` e teste.
- Scripts da raiz: `dev`, `check`, `db:bundle`, `gen:api-types`, `seed:dev`, `check:rls`, `load:test`.

## Fase 1: núcleo sem backend (concluída)
- Schemas Zod: mensagem do canal (`lib/realtime/schemas.ts`, com checagem de spans), termo e pacote (`lib/terms/schemas.ts`), variáveis públicas (`lib/env.ts`).
- Pacote `programacao-geral.json` com 40 termos, 3 profundidades em pt e `short` em en/es para 15 termos. **Todos `reviewed: false`.**
- Corretor `lib/terms/matcher.ts` (1 a 3 tokens, maior correspondência, texto e spans no mesmo passo) com 16 testes.
- `SttProvider`, `WebSpeechProvider` (reinício com backoff 250 ms → 3 s, limite de 8 erros, erros de permissão fatais, deduplicação de finais) e `FakeSttProvider` (roteiro `content/demo/aula-demo.json`).
- `LocalTransport` (BroadcastChannel, com pedido de histórico respondido pela aba do professor) e `CaptionClient`/`CaptionStore` (`lastSeq`, lacunas, duplicatas, recuperação ao conectar).
- Páginas `/demo/professor` e `/demo/estudante`: teste de microfone de 10 s com medidor, iniciar/pausar, indicador "Transcrição ativa", palavras por minuto, frases com termos destacados, legenda grande com controle de fonte, rolagem automática com "Voltar ao vivo (N novas)", folha de explicação com 3 profundidades e idioma, wake lock, painel `?debug=1`.
- Verificado no navegador: frase chega na outra aba em ~1 ms (painel de depuração), termos destacados, toque abre explicação, recarregar a aba do estudante recupera as frases perdidas.

## Fase 2: Supabase, login e aula real (concluída)
- Migrações em `supabase/migrations/` (schema, RLS, funções, realtime, cron) e `supabase/bundle.sql` (aplicado no projeto real).
- Clientes Supabase (navegador singleton, servidor, `proxy.ts` renovando a sessão com `getClaims()` e mandando quem não tem sessão para `/entrar?next=`).
- Login por link no e-mail, Google (atrás de `NEXT_PUBLIC_GOOGLE_LOGIN`) e login de desenvolvimento por senha (`NEXT_PUBLIC_DEV_LOGIN`). `npm run seed:dev` cria 1 professor e 8 estudantes.
- Estudante: `/aula/[codigo]` → login → volta ao mesmo lugar → consentimentos (um por tela, nada pré-marcado) → `join_lesson` → legenda.
- Professor: `/professor` (minhas aulas), `/professor/aulas/nova` (código de 6 caracteres com nova tentativa em colisão), ao vivo com QR code projetável, contador via `lesson_member_count`, `seq` que continua após recarregar.
- `SupabaseTransport` (canal privado `lesson:<id>`), gravação em `utterances`, recuperação paginada (testada com 2.500 linhas).
- API Python: `/health`, configuração, CORS restrito a `WEB_ORIGIN`, validação do token via `/auth/v1/user` com cache de 10 s (7 testes).
- `npm run check:rls` contra o projeto real: **30/30** (26 regras de banco + 4 de Realtime, inclusive estudante de fora recusado no canal privado). `npm run db:validate` repete 35 verificações num Postgres embutido, sem Supabase.
- Verificado no navegador (professor em `localhost`, estudante em `127.0.0.1`): frase chega ao estudante em 28–33 ms; recarregar o estudante recupera as frases; recarregar o professor continua do `seq` seguinte.

## Fase 3: resumo, quiz e revisão (concluída)
- API: `POST /lessons/{id}/end` (idempotente; encerra, lê todas as frases paginando, grava o instantâneo em `lesson_reports` sem texto, gera rascunhos), `POST /lessons/{id}/materials/regenerate` (409 se houver material aprovado, se a aula não terminou ou se a transcrição expirou), `POST /cron/purge` (`X-Cron-Secret`), `DELETE /me` (pronto para a Fase 4).
- LLM: provedores `mock` e `anthropic` (SDK oficial assíncrono, `output_config.format` com esquema JSON, `effort` configurável, `fallbacks: "default"` opcional), extração de JSON tolerante a cercas e texto extra, validação Pydantic (3–6 tópicos, 5 questões, 4 opções, ≥2 de código) com uma nova tentativa informando o erro, divisão em blocos acima de 40.000 caracteres.
- `sanitize.py` remove e-mails, URLs e telefones antes do LLM. `report.py`: ritmo por minuto, 3 minutos mais rápidos, termos sem definição (heurística).
- 38 testes `pytest`, com um Supabase falso em memória (inclui paginação de 2.500 frases, 403 para quem não é dono, idempotência, falha do LLM mantendo a aula encerrada).
- `web/`: `/professor/aulas/[id]/revisar` (editar resumo e cada questão, salvar, aprovar, descartar, tentar de novo) e `/aula/[codigo]/revisao` (resumo e quiz aprovados, uma questão por vez, sem gravar respostas). Tipos vindos de `npm run gen:api-types`.
- Verificado no navegador com `LLM_PROVIDER=mock`: encerrar → rascunho → estudante ainda não vê → professor edita e aprova → estudante vê a versão editada e responde o quiz.

## Fase 4: Nível 2 (concluída)
- Profundidade e idioma da explicação salvos no perfil (no modo demonstração ficam no aparelho).
- **Modo único** (pedido da equipe em 03/11/2026, substitui "modo calmo" e "ao pé da letra"): não há botões de modo; a tradução literal de termos figurativos aparece sempre na explicação, e o movimento reduzido segue a configuração do sistema (`prefers-reduced-motion`).
- Toques e botões "Ajudou", "Não ajudou" e "Ainda tenho dúvida" gravam `term_events` com o pseudônimo do próprio estudante.
- Correção de termo pelo professor (`term_corrections`) na tela ao vivo: vira variação extra do dicionário na hora e nas próximas aulas.
- Relatório `/professor/aulas/[id]/relatorio`: participantes, ritmo por minuto, trechos rápidos, termos sem definição e termos mais consultados (mínimo de 3 estudantes).
- `/conta`: consentimentos (conceder e revogar) e "Excluir meus dados" (`delete_my_data()` com o token do usuário e depois exclusão da conta pela API com a chave secreta, só do próprio id).
- `check:rls` ampliado para **34/34**: o relatório mostra termo com 3 estudantes, omite termo com 1 e não contém ids, pseudônimos nem e-mails.
- Verificado no navegador: profundidade persiste após recarregar; eventos chegam ao banco; correção salva; aula muda para "ao vivo" sem reabrir o canal; exclusão apaga a conta.
- Bug corrigido no caminho: consultas `supabase-js` disparadas com `void` nunca executam (são preguiçosas). Agora passam por `lib/supabase/fire.ts`.

## Fase 5: robustez e demo (concluída)
- `scripts/load_test.py` (Python, biblioteca `realtime`): N clientes num canal privado, 1 publicando a cada 2 s; mede p50/p95/máx e perdas, apaga a aula no fim. Resultado na seção abaixo.
- Painel `?debug=1` no estudante (latência `now - sentAt`, `seq` atual, conexão).
- Acessibilidade: foco visível em tudo, alvos de toque de 44 px, termos com `aria-label`, `aria-live` na legenda, `h-dvh`, `lang="pt-BR"`, `prefers-reduced-motion` respeitado.
- **Fim de aula para o estudante** (pedido em 03/11/2026): ao encerrar, o professor envia `lesson_ended` no canal; o estudante conectado vê a faixa "A aula terminou" com o botão **Ver resumo e quiz**. Quem perdeu o aviso recebe o botão ao reconectar (checagem do status) ou em até 30 s. A tela de revisão mostra "Aguardando a aprovação do professor" e atualiza sozinha a cada 15 s até o material ser aprovado. Verificado no navegador.
- PWA: `app/manifest.ts` e ícones 192/512 (sem service worker).
- API mantida acordada durante a aula (`/health` a cada 5 min na tela ao vivo).
- `docs/TESTE_MANUAL.md` (Teste A, Teste B, A/B de 1 hora, checklist), `docs/DEPLOY.md`, `README.md`.

- **Ajustes de 03/11/2026**: correção aproximada de termos (grafias a 1 letra de distância, com proteções contra palavras do português), filtro de palavrões antes de publicar (`***`), botão "Baixar resumo em PDF" para estudante e professor (este com quiz e gabarito). Testados com unidade e no navegador.

### Resultado do teste de carga (rede doméstica, Supabase região padrão do projeto)
`npm run load:test` em 03/11/2026: **40 clientes, 300 frases (1 a cada 2 s, 10 min), 12.000/12.000 recebimentos, 0 perdas. Latência p50 51 ms, p95 635 ms, média 220 ms, máximo 18,5 s.** Meta (p95 < 2 s) atingida. O máximo isolado de 18,5 s indica uma pausa de conexão (provável reconexão de um cliente); no app, a recuperação por `seq` cobre esse caso, mas vale repetir o teste na rede da escola. Teste curto anterior (10 clientes, 30 s): p95 289 ms.

## O que NÃO foi testado em condições reais
- **Microfone de verdade em sala de aula** (Web Speech API com ruído, eco, sotaques). Só o roteiro falso foi usado; o reinício automático e os erros de permissão estão implementados mas não exercitados com fala real.
- **Celulares reais** (Android e iOS/Safari), inclusive wake lock e troca de rede 4G/Wi-Fi. Os testes usaram o navegador do computador, com viewport de celular.
- **Provedor `anthropic` com chamada real** (não há `ANTHROPIC_API_KEY`). Os testes cobrem o fluxo com provedores falsos; a primeira chamada real pode pedir ajuste (por exemplo, `fallbacks` junto com `output_config.format`). Se der erro 400, use `LLM_FALLBACKS=false`.
- **API hospedada** (cold start, limites de tempo): só rodou localmente.
- **Link por e-mail e Google**: implementados; os testes usaram o login de desenvolvimento por senha.
- **`pg_cron`**: não verifiquei se a extensão foi ativada no seu projeto. Se não estiver, use o plano B (`POST /cron/purge`, veja `docs/DEPLOY.md`).

## Papéis e painel da aula (04/11/2026)
- Professor e aluno separados no banco, nas rotas e no menu; área do aluno em `/aluno`; painel da aula após encerrar (PDF, conferir quiz, relatório); termo clicável no console do professor.
- (Supabase, já substituído pelo Firebase.)

## Espanhol (05/11/2026)
- Legenda traduzida ao vivo (Chrome do professor), telas do aluno, explicações completas dos 40 termos, resumo, quiz e PDF em espanhol.
- (Supabase, já substituído pelo Firebase.)
- Para traduzir, o professor usa o Google Chrome 138+ no computador e clica em "Ativar tradução para espanhol" (o Chrome baixa o pacote de idioma uma vez).

## Redesenho de UI/UX (05/11/2026)
- Todas as telas redesenhadas sem mudar funcionalidades: página inicial (com prévia interativa de termo), login, demonstrações, console do professor, legenda do aluno, explicação do termo, minhas aulas, nova aula, aula ao vivo, painel, relatório (gráfico de ritmo), revisão do resumo e quiz, quiz, área do aluno, consentimentos, minha conta e 404.
- Modo escuro (segue o sistema, com botão de sol/lua), botões e campos maiores, avisos coloridos com ícone, estados de carregamento e vazio.
- Novos recursos de UX: mostrar senha, copiar código/link, filtro de aulas por status, contadores de caracteres, contagem do teste de microfone, guia de 3 passos na demonstração.
- Corrigido: a legenda abria no menor tamanho de letra na primeira visita.
- Tiradas da interface as menções à "demonstração offline" (seção da página inicial, atalhos no login, textos "sem login"). As páginas `/demo/professor` (agora "Painel do professor") e `/demo/estudante` ("Legenda ao vivo") continuam abrindo pelo endereço; o botão "Usar aula de demonstração" do console continua, por ser um recurso.
- Tirados os selos de privacidade da página inicial e a linha de privacidade do rodapé (pedido do usuário). As mesmas informações seguem nos textos de consentimento e no aviso do relatório.
- Verificado no navegador (claro e escuro, computador e celular): demonstração professor → estudante, abrir termo, quiz, relatório e editores com dados de exemplo. Telas com Supabase não foram abertas com dados reais (sem `.env` nesta máquina).

## Migração para o Firebase (05/11/2026, branch `firebase`)
- **Supabase removido.** Login no Firebase Authentication (e-mail/senha com confirmação, Google opcional, redefinição de senha), banco no Cloud Firestore, regras em `firestore.rules`, índices em `firestore.indexes.json`, emuladores em `firebase.json`. Projeto: `echodev-eb4fb`.
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

## Pendências para a equipe
- **Aprovar o uso do Gemini gratuito** com a instituição: no plano gratuito o Google pode usar a transcrição enviada para melhorar os produtos dele (no plano pago, não).
- **Revisão humana do conteúdo** dos 40 termos (explicações e traduções) antes da demo. Nada na interface diz "verificado".
- Variações fonéticas são hipóteses: validar no Teste A (`docs/TESTE_MANUAL.md`).
- **Textos de consentimento** são marcadores ("texto a ser aprovado pela instituição"); definir o fluxo para menores de 18 anos com a instituição.
- **SMTP próprio** no Supabase para a demo real (o envio padrão de links tem limite baixo).
- **Escolher e configurar a hospedagem** da API (`docs/DEPLOY.md`) e as URLs de redirecionamento de produção.
- Trocar a chave secreta do Supabase depois do hackathon (ela foi compartilhada no chat durante o desenvolvimento).

### Termos propensos a falso positivo (curadoria)
Palavras comuns do português que também são termos: `objeto`, `classe`, `método`, `função`, `variável`, `parâmetro`, `biblioteca`, `repositório`, `algoritmo`. Outros riscos: `jason` (nome próprio) como variação de JSON; `repo`; `bug`/`merge` em conversa informal. `for` ficou de fora de propósito ("se ele **for**").

## Ideias fora do escopo
- Ensinar ao corretor plurais automáticos (hoje são listados em `forms`).
- Painel de curadoria das correções de termos (`term_corrections`) para promovê-las ao pacote versionado.
- Curadoria dos termos aprovados da IA (`glossaryTerms`): editar ou remover um termo depois de aprovado.
