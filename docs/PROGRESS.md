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

## Pendências
- **Revisão humana do conteúdo** dos 40 termos (explicações e traduções) antes da demo. Nada na interface diz "verificado".
- Variações fonéticas são hipóteses: validar no Teste A (`docs/TESTE_MANUAL.md`, Fase 5).
- Fases 2 a 5.

### Termos propensos a falso positivo (curadoria)
Palavras comuns do português que também são termos: `objeto`, `classe`, `método`, `função`, `variável`, `parâmetro`, `biblioteca`, `repositório`, `algoritmo`. Outros riscos: `jason` (nome próprio) como variação de JSON; `repo`; `bug`/`merge` em conversa informal. `for` ficou de fora de propósito ("se ele **for**").

## Ideias fora do escopo
- Legenda traduzida ao vivo (fora do MVP por definição).
- Ensinar ao corretor plurais automáticos (hoje são listados em `forms`).
