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

## Pendências
- Botão "Encerrar aula" depende da rota `POST /lessons/{id}/end` (Fase 3).
- Teste com celular real na rede local e com microfone de verdade (Web Speech) ainda não feito.
- **Revisão humana do conteúdo** dos 40 termos (explicações e traduções) antes da demo. Nada na interface diz "verificado".
- Variações fonéticas são hipóteses: validar no Teste A (`docs/TESTE_MANUAL.md`, Fase 5).
- Fases 2 a 5.

### Termos propensos a falso positivo (curadoria)
Palavras comuns do português que também são termos: `objeto`, `classe`, `método`, `função`, `variável`, `parâmetro`, `biblioteca`, `repositório`, `algoritmo`. Outros riscos: `jason` (nome próprio) como variação de JSON; `repo`; `bug`/`merge` em conversa informal. `for` ficou de fora de propósito ("se ele **for**").

## Ideias fora do escopo
- Legenda traduzida ao vivo (fora do MVP por definição).
- Ensinar ao corretor plurais automáticos (hoje são listados em `forms`).
