# EchoDev: regras duras para agentes

MVP do Hack4Edu 2026. Legenda ao vivo de aula de programação com termos destacados e explicações; resumo/quiz por IA aprovados pelo professor. Leia `docs/PROGRESS.md` (estado atual) e `docs/DECISIONS.md` antes de mexer.

## Como trabalhar
- Fase a fase. Ao fim de cada fase: `npm run check` verde (lint, tipos, testes e build do `web/`; ruff + pytest do `api/`; tipos da API em dia) e commit `fase N: resumo` em português.
- Atualize `docs/PROGRESS.md` a cada fase. Dúvida menor: escolha o mais simples e registre em `docs/DECISIONS.md`. Duas tentativas falhas: registre em `docs/BLOCKERS.md` e use o plano B.
- Não invente APIs/flags/modelos: confira docs oficiais e versão instalada. **Next.js 16**: leia `web/node_modules/next/dist/docs/` (middleware virou `proxy.ts`; `params`, `searchParams`, `cookies()`, `headers()` são assíncronos).
- Sem comandos interativos. Nada fora do escopo (anote em "Ideias fora do escopo").
- Interface e docs em pt-BR; código, tabelas e comentários em inglês. Textos da interface só em `web/src/lib/i18n/pt-BR.ts`.

## Stack
- Servidor = Python (`api/`): FastAPI, Pydantic v2, pydantic-settings, httpx assíncrono (PostgREST/Auth com o **token do usuário**), SDK `anthropic` + provedor `mock`. Modelo em `LLM_MODEL`. `supabase-py` só em `scripts/`.
- Navegador = TypeScript (`web/`): Next.js App Router, Tailwind, shadcn/ui, `@supabase/ssr`, Zod, Vitest. Web Speech API atrás de `SttProvider`. Corretor de termos roda no navegador do professor (nunca no servidor).
- Ao vivo não passa por Python nem IA: professor → `RealtimeTransport` (canal privado `lesson:<id>`) + `utterances` → estudantes.
- PWA só com manifest e ícones (sem service worker).
- Ambiente Windows: venv em `api/.venv/Scripts/python.exe`; use `node scripts/py.mjs` (acha o Python nos dois sistemas).

## Segurança e privacidade
- RLS em todas as tabelas. Professor nunca lê `term_events` nem `profiles` de estudantes; só funções agregadas (mínimo de estudantes).
- Áudio nunca é gravado. Transcrição expira em 24 h. Nunca enviar e-mail/nome/pseudônimo ao LLM; sanitizar antes.
- Consentimento por finalidade, nunca pré-marcado, revogável; textos são marcadores ("texto a ser aprovado pela instituição").
- `service_role` só em `/cron/purge`, exclusão da própria conta e `scripts/`. Nunca no cliente. Nunca commit de `.env*` (exceto `.env.example`), `api/.venv`, `node_modules`.
- Funções `security definer` com `set search_path = ''` e nomes qualificados.
