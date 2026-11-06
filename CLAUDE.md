# EchoDev: regras duras para agentes

MVP do Hack4Edu 2026. Legenda ao vivo de aula de programação com termos destacados e explicações; resumo/quiz por IA aprovados pelo professor. Leia `docs/PROGRESS.md` (estado atual) e `docs/DECISIONS.md` antes de mexer.

## Como trabalhar
- Fase a fase. Ao fim de cada fase: `npm run check` verde (lint, tipos, testes e build do `web/`; ruff + pytest do `api/`; tipos da API em dia) e commit `fase N: resumo` em português.
- Atualize `docs/PROGRESS.md` a cada fase. Dúvida menor: escolha o mais simples e registre em `docs/DECISIONS.md`. Duas tentativas falhas: registre em `docs/BLOCKERS.md` e use o plano B.
- Não invente APIs/flags/modelos: confira docs oficiais e versão instalada. **Next.js 16**: leia `web/node_modules/next/dist/docs/` (middleware virou `proxy.ts`; `params`, `searchParams`, `cookies()`, `headers()` são assíncronos).
- Sem comandos interativos. Nada fora do escopo (anote em "Ideias fora do escopo").
- Interface e docs em pt-BR; código, tabelas e comentários em inglês. Textos da interface só em `web/src/lib/i18n/pt-BR.ts`.

## Stack
- Servidor = Python (`api/`): FastAPI, Pydantic v2, pydantic-settings, `firebase-admin` (valida o **ID token do usuário** e acessa o Firestore pela camada `app/store.py`), SDKs `google-genai` (Gemini, plano gratuito) e `anthropic` + provedor `mock`. Provedor em `LLM_PROVIDER`, modelo em `LLM_MODEL`.
- Navegador = TypeScript (`web/`): Next.js App Router, Tailwind, shadcn/ui, Firebase JS SDK (Auth + Firestore, sem Analytics), Zod, Vitest. Web Speech API atrás de `SttProvider`. Corretor de termos roda no navegador do professor (nunca no servidor).
- Ao vivo não passa por Python nem IA: professor grava `lessons/{id}/utterances` → estudantes recebem por listener do Firestore (`FirestoreTransport`).
- Banco, regras e índices: `firestore.rules`, `firestore.indexes.json`, `firebase.json` (emuladores). Teste local com `npm run dev:emulators`.
- PWA só com manifest e ícones (sem service worker).
- Ambiente Windows: venv em `api/.venv/Scripts/python.exe`; use `node scripts/py.mjs` (acha o Python nos dois sistemas).

## Segurança e privacidade
- `firestore.rules` nega tudo que não está explícito; toda mudança nas regras vem com caso em `web/rules-tests/` (`npm run test:rules`). Professor nunca lê `termEvents`, `lessonMembers` nem `profiles` de estudantes; só agregados da API (mínimo de 3 estudantes).
- Áudio nunca é gravado. Transcrição expira em 24 h. Nunca enviar e-mail/nome/pseudônimo ao LLM; sanitizar antes.
- Consentimento por finalidade, nunca pré-marcado, revogável; textos são marcadores ("texto a ser aprovado pela instituição").
- Conta de serviço (Admin SDK) só na API e em `scripts/`, nunca no cliente; ela ignora as regras, então toda rota confere quem chama (dono da aula, o próprio usuário). Nunca commit do JSON da conta de serviço. Nunca commit de `.env*` (exceto `.env.example`), `api/.venv`, `node_modules`.
- Membros e eventos de termos usam o pseudônimo, nunca o uid. Analytics do Firebase não é usado.
