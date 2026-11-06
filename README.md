# EchoDev

> Uma mesma explicação que pode servir para todo tipo de estudante, com qualquer ritmo de aprendizado.

MVP do Hack4Edu 2026. O EchoDev ouve o professor de uma aula de programação e entrega a aula ao estudante como **legenda ao vivo** com **termos técnicos destacados** (toque no termo para ver a explicação curta, com exemplo ou passo a passo, em português, inglês ou espanhol). Ao final, o professor revisa e aprova um **resumo e um quiz** gerados por IA, e vê um **relatório anônimo** de clareza.


## Como rodar no localhost:3000

### 1. Instalar (só na primeira vez)
```bash
npm install
npm --prefix web install
# API Python (Windows)
python -m venv api\.venv && api\.venv\Scripts\pip install -r api\requirements-dev.txt
# API Python (macOS / Linux)
python3 -m venv api/.venv && api/.venv/bin/pip install -r api/requirements-dev.txt
```

### 2. Configurar (só na primeira vez)
- Copie `web/.env.example` para `web/.env.local`, `api/.env.example` para `api/.env` e `.env.example` para `.env`, e preencha (veja [Configuração](#configuração)).
- Salve a chave da conta de serviço do Firebase em `api/firebase-service-account.json` (passo a passo em `docs/SETUP_MANUAL.md`). Ela fica fora do git.
- Crie os usuários de teste no Firebase:
  ```bash
  npm run seed:dev
  ```

### 3. Rodar
```bash
npm run dev
```
Espere aparecer `Ready` e abra **http://localhost:3000**. O mesmo comando sobe a API em http://localhost:8000; ela não tem página própria (o site a chama sozinho), mas http://localhost:8000/health deve mostrar `{"status":"ok"}`. Para parar, aperte **Ctrl+C** no terminal.

### 4. Entrar com os usuários de teste
Todos usam a mesma senha:

| Papel | E-mail | Senha |
|---|---|---|
| **Professor** | `professor.teste@echodev.test` | `yNOcU_gm3PjPuJ8J` |
| **Aluno** | `estudante1.teste@echodev.test` | `yNOcU_gm3PjPuJ8J` |
| Outros alunos | `estudante2.teste@echodev.test` … `estudante8.teste@echodev.test` | `yNOcU_gm3PjPuJ8J` |

A senha vem de `DEV_USERS_PASSWORD` no `.env` da raiz. Se trocar o valor lá, rode `npm run seed:dev` de novo para atualizar todos os usuários.

### 5. Roteiro de teste
Use uma **janela anônima** (Ctrl+Shift+N no Chrome) para o aluno: cada janela guarda um login.
1. **Professor**: entre em http://localhost:3000/entrar, clique em **Nova aula**, dê um título e crie. Anote o código de 6 caracteres.
2. **Aluno** (janela anônima): entre, digite o código em **Entrar em uma aula** e aceite os consentimentos.
3. **Professor**: clique em **Usar aula de demonstração** (frases prontas) ou em **Iniciar transcrição** (microfone, no Chrome ou Edge).
4. **Aluno**: as frases chegam ao vivo; toque num termo destacado e responda "Essa explicação ajudou?".
5. **Professor**: **Encerrar aula** → **Revisar e aprovar** → **Aprovar** no resumo e no quiz.
6. **Aluno**: clique em **Ver resumo e quiz** e responda o quiz.


### Se algo der errado
- **"E-mail ou senha incorretos"**: rode `npm run seed:dev`.
- **"Port 3000 is in use"**: feche outro terminal que esteja rodando o site.
- **Erro em "Minhas aulas" logo depois do deploy das regras**: os índices do Firestore ainda estão sendo criados; espere alguns minutos.
- **Outros erros**: veja as linhas `[api]` no terminal e o console do navegador (F12).

## Demonstração em 2 minutos (sem internet, sem conta)
1. `npm --prefix web run dev`.
2. Abra http://localhost:3000/demo/professor e, em outra aba, http://localhost:3000/demo/estudante.
3. No professor, clique em **Usar aula de demonstração**: as frases aparecem na aba do estudante, com "comiti" corrigido para **commit**, "pul rikuesti" para **pull request** etc.
4. No estudante, toque num termo destacado, troque a profundidade e o idioma, aumente a letra, role para cima para reler ("Voltar ao vivo").

## Configuração
Copie os exemplos e preencha (passo a passo em `docs/SETUP_MANUAL.md`):

| Arquivo | Para quê | Principais variáveis |
|---|---|---|
| `web/.env.local` | navegador | `NEXT_PUBLIC_FIREBASE_*` (configuração web pública do Firebase), `NEXT_PUBLIC_FIREBASE_EMULATORS`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_LOGIN` |
| `api/.env` | API Python | `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_FILE` (JSON da conta de serviço, secreto), `WEB_ORIGIN`, `CRON_SECRET`, `LLM_PROVIDER` (`mock`, `gemini` gratuito ou `anthropic` pago), `LLM_MODEL`, `GEMINI_API_KEY`, `GEMINI_FALLBACK_MODEL`, `ANTHROPIC_API_KEY`, `LLM_EFFORT`, `LLM_FALLBACKS` |
| `.env` (raiz) | scripts administrativos | `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_FILE`, `DEV_USERS_PASSWORD`, `DEV_TEACHER_EMAIL` |

Banco: `firebase login` e `npm run deploy:rules` (envia `firestore.rules` e `firestore.indexes.json`).

## Scripts
| Script | O que faz |
|---|---|
| `npm run dev` | web + api juntos |
| `npm run check` | lint, tipos, testes e build do `web/`; ruff + pytest do `api/` e `scripts/`; confere se os tipos da API estão em dia |
| `npm run dev:emulators` | emuladores do Firebase + usuários de teste + API + web, sem tocar no projeto real |
| `npm run deploy:rules` | envia as regras de acesso e os índices do Firestore |
| `npm run test:rules` | prova `firestore.rules` no emulador do Firestore |
| `npm run gen:api-types` | gera `web/src/lib/api/schema.d.ts` a partir do OpenAPI do FastAPI |
| `npm run seed:dev` | cria 1 professor e 8 estudantes de teste (e-mails confirmados) |
| `npm run teacher:add -- email` | autoriza um e-mail como professor (a pessoa cria a conta em `/entrar`) |
| `npm run load:test` | 40 clientes num canal por 10 min (`-- --clients 10 --minutes 1` para um teste curto) |

## Estrutura
```
web/        Next.js 16 (App Router, TypeScript, Tailwind, shadcn/ui)
  src/lib/terms     corretor de termos (matcher.ts) e pacote de termos
  src/lib/stt       SttProvider, Web Speech, aula falsa
  src/lib/realtime  RealtimeTransport (local e Firestore), recuperação por seq
  src/lib/firebase  cliente do Firebase, perfil do usuário
  src/content       pacote de 40 termos e roteiro da aula de demonstração
api/        FastAPI (Python): encerrar aula, resumo/quiz por IA, limpeza, exclusão de conta
firestore.rules, firestore.indexes.json, firebase.json   regras, índices e emuladores
scripts/    seed, teacher:add, load_test, emuladores (dev_emulators.mjs)
docs/       PROGRESS, DECISIONS, BLOCKERS, SETUP_MANUAL, TESTE_MANUAL, DEPLOY
```

## Documentação
- `docs/PROGRESS.md`: o que está pronto e o que falta.
- `docs/DECISIONS.md`: decisões e porquês.
- `docs/SETUP_MANUAL.md`: o que só uma pessoa com acesso ao painel pode fazer.
- `docs/TESTE_MANUAL.md`: roteiros de teste com pessoas e aparelhos reais.
- `docs/DEPLOY.md`: opções de hospedagem.
