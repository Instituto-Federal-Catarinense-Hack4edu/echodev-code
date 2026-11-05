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
- **Ação manual**: colar `supabase/migrations/20261104000600_roles.sql` no SQL Editor do Supabase (só esse arquivo, não o bundle).

## Espanhol (05/11/2026)
- Legenda traduzida ao vivo (Chrome do professor), telas do aluno, explicações completas dos 40 termos, resumo, quiz e PDF em espanhol.
- **Ação manual**: colar `supabase/migrations/20261105000100_spanish.sql` no SQL Editor do Supabase (depois da migração de papéis). Sem ela, as frases continuam sendo salvas só em português.
- Para traduzir, o professor usa o Google Chrome 138+ no computador e clica em "Ativar tradução para espanhol" (o Chrome baixa o pacote de idioma uma vez).

## Pendências para a equipe
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
