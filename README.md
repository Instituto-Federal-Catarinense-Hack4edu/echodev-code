# EchoDev

> Uma mesma explicação que pode servir para todo tipo de estudante, com qualquer ritmo de aprendizado.

MVP do Hack4Edu 2026. O EchoDev ouve o professor de uma aula de programação e entrega a aula ao estudante como **legenda ao vivo** com **termos técnicos destacados** (toque no termo para ver a explicação curta, com exemplo ou passo a passo, em português, inglês ou espanhol). Ao final, o professor revisa e aprova um **resumo e um quiz** gerados por IA, e vê um **relatório anônimo** de clareza.

- Áudio nunca é gravado; a transcrição é apagada em 24 h.
- O professor nunca vê nomes nem e-mails de estudantes; só números agregados (mínimo de 3 estudantes).
- Consentimento por finalidade, nunca pré-marcado.

## Demonstração em 2 minutos (sem internet, sem conta)
1. `npm run dev` (ou só `npm --prefix web run dev`).
2. Abra http://localhost:3000/demo/professor e, em outra aba, http://localhost:3000/demo/estudante.
3. No professor, clique em **Usar aula de demonstração**: as frases aparecem na aba do estudante, com "comiti" corrigido para **commit**, "pul rikuesti" para **pull request** etc.
4. No estudante, toque num termo destacado, troque a profundidade e o idioma, aumente a letra, role para cima para reler ("Voltar ao vivo").

## Requisitos
- Node.js 20 ou superior (testado com 22) e npm.
- Python 3.11 ou superior (testado com 3.12).
- Um projeto Supabase (veja `docs/SETUP_MANUAL.md`). Docker e Supabase CLI **não** são necessários.
- Professor: Chrome ou Edge no computador (Web Speech API).

## Instalação
```bash
npm install
npm --prefix web install
```

API Python (ambiente virtual em `api/.venv`, fora do git):

```bash
# macOS / Linux
python3 -m venv api/.venv && api/.venv/bin/pip install -r api/requirements-dev.txt
# Windows
python -m venv api\.venv && api\.venv\Scripts\pip install -r api\requirements-dev.txt
```

Os scripts da raiz encontram o Python do venv nos dois sistemas (`scripts/py.mjs`).

## Configuração
Copie os exemplos e preencha (passo a passo em `docs/SETUP_MANUAL.md`):

| Arquivo | Para quê | Principais variáveis |
|---|---|---|
| `web/.env.local` | navegador | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave pública), `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DEV_LOGIN`, `NEXT_PUBLIC_GOOGLE_LOGIN` |
| `api/.env` | API Python | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secreta), `WEB_ORIGIN`, `CRON_SECRET`, `LLM_PROVIDER` (`mock` ou `anthropic`), `LLM_MODEL`, `ANTHROPIC_API_KEY`, `LLM_EFFORT`, `LLM_FALLBACKS` |
| `.env` (raiz) | scripts administrativos | `SUPABASE_*`, `DEV_USERS_PASSWORD`, `DEV_TEACHER_EMAIL` |

Banco: `npm run db:bundle` e cole `supabase/bundle.sql` no SQL Editor do Supabase.

## Rodando
```bash
npm run dev
```
Sobe o `web/` em http://localhost:3000 e a API em http://localhost:8000 (`/health`, documentação em `/docs`).

## Scripts
| Script | O que faz |
|---|---|
| `npm run dev` | web + api juntos |
| `npm run check` | lint, tipos, testes e build do `web/`; ruff + pytest do `api/` e `scripts/`; confere se os tipos da API estão em dia |
| `npm run db:bundle` | junta `supabase/migrations/*.sql` em `supabase/bundle.sql` |
| `npm run db:validate` | aplica o bundle num Postgres embutido (sem Supabase) e testa as regras de RLS |
| `npm run gen:api-types` | gera `web/src/lib/api/schema.d.ts` a partir do OpenAPI do FastAPI |
| `npm run seed:dev` | cria 1 professor e 8 estudantes de teste (e-mails confirmados) |
| `npm run teacher:add -- email` | autoriza um e-mail como professor (a pessoa cria a conta em `/entrar`) |
| `npm run check:rls` | prova as regras de acesso no Supabase real, inclusive o canal privado |
| `npm run load:test` | 40 clientes num canal por 10 min (`-- --clients 10 --minutes 1` para um teste curto) |

## Estrutura
```
web/        Next.js 16 (App Router, TypeScript, Tailwind, shadcn/ui)
  src/lib/terms     corretor de termos (matcher.ts) e pacote de termos
  src/lib/stt       SttProvider, Web Speech, aula falsa
  src/lib/realtime  RealtimeTransport (local e Supabase), recuperação por seq
  src/content       pacote de 40 termos e roteiro da aula de demonstração
api/        FastAPI (Python): encerrar aula, resumo/quiz por IA, limpeza, exclusão de conta
supabase/   migrações (schema, RLS, funções, realtime, cron) e bundle.sql
scripts/    seed, check_rls, load_test, validação local do SQL
docs/       PROGRESS, DECISIONS, BLOCKERS, SETUP_MANUAL, TESTE_MANUAL, DEPLOY
```

## Documentação
- `docs/PROGRESS.md`: o que está pronto e o que falta.
- `docs/DECISIONS.md`: decisões e porquês.
- `docs/SETUP_MANUAL.md`: o que só uma pessoa com acesso ao painel pode fazer.
- `docs/TESTE_MANUAL.md`: roteiros de teste com pessoas e aparelhos reais.
- `docs/DEPLOY.md`: opções de hospedagem.

**Conteúdo dos termos escrito por IA e ainda não revisado** (`reviewed: false`). Textos de consentimento são marcadores ("texto a ser aprovado pela instituição"). Não é parecer jurídico.
