
# 🚀 EchoDev#Code

[![LGPD Compliant](https://img.shields.io/badge/LGPD-Privacy%20by%20Design-success?style=flat-square)](PRIVACY.md)
[![PYTHON Version](https://img.shields.io/badge/python-3670A0?style=flat-square&logo=python&logoColor=ffdd54)](https://www.python.org/)
[![REACT Version](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js Version](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![GEMINI Version](https://img.shields.io/badge/Google-Gemini-yellow?style=flat-square&logo=google)](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/2-5-flash?hl=pt-br)

# EchoDev

> Uma mesma explicação que pode servir para todo tipo de estudante, com qualquer ritmo de aprendizado.

MVP do Hack4Edu 2026. O EchoDev ouve o professor de uma aula de programação e entrega a aula ao estudante como **legenda ao vivo** com **termos técnicos destacados** (toque no termo para ver a explicação curta, com exemplo ou passo a passo, em português, inglês ou espanhol). Ao final, o professor revisa e aprova um **resumo e um quiz** gerados por IA, e vê um **relatório anônimo** de clareza.


## Como testar, passo a passo

### 0. O que você precisa ter
- **Git**, **Node.js 22** e **Python 3.11 ou mais novo**.
- **Google Chrome** (ou Edge) no computador. Para testar a legenda em espanhol: Chrome 138 ou mais novo.
- **Acesso ao projeto Firebase `echodev-eb4fb`**: peça a quem administra para te adicionar em *Configurações do projeto > Usuários e permissões* (papel Editor). Sem acesso, use o modo local da seção [Sem acesso ao Firebase](#sem-acesso-ao-firebase-modo-local).

### 1. Clonar
```bash
git clone https://github.com/Instituto-Federal-Catarinense-Hack4edu/echodev-code.git
cd echodev-code
```

### 2. Instalar (só na primeira vez)
```bash
npm install
npm --prefix web install
# API Python (Windows)
python -m venv api\.venv && api\.venv\Scripts\pip install -r api\requirements-dev.txt
# API Python (macOS / Linux)
python3 -m venv api/.venv && api/.venv/bin/pip install -r api/requirements-dev.txt
```

### 3. Configurar (só na primeira vez)
Copie os três modelos (ficam fora do git):

| Copie | Para | O que preencher |
|---|---|---|
| `web/.env.example` | `web/.env.local` | Configuração web do Firebase: no console, *Configurações do projeto > Seus apps > app Web* (valores públicos) |
| `api/.env.example` | `api/.env` | `FIREBASE_PROJECT_ID=echodev-eb4fb` (o resto já vem pronto) |
| `.env.example` | `.env` | `FIREBASE_PROJECT_ID=echodev-eb4fb` e `DEV_USERS_PASSWORD` (a senha dos usuários de teste, veja o passo 5) |

Depois:
- **Chave da conta de serviço** (secreta): no console, *Configurações do projeto > Contas de serviço > Gerar nova chave privada*. Salve como `api/firebase-service-account.json`. Nunca mande esse arquivo por chat nem faça commit dele.
- **IA (opcional, gratuita)**: sem chave, a API usa o modo `mock` (resumo, quiz e glossário fixos, iguais em toda aula). Para a IA de verdade, crie uma chave grátis em https://aistudio.google.com (*Get API key*, sem cartão) e, no `api/.env`, use:
  ```
  LLM_PROVIDER=gemini
  GEMINI_API_KEY=<sua chave>
  ```
  Não ative faturamento no projeto da chave: no plano gratuito não há custo.

### 4. Regras do banco
As regras de acesso e os índices já estão publicados no projeto `echodev-eb4fb`. Só rode isto se alguém mudou `firestore.rules` ou `firestore.indexes.json`:
```bash
firebase login            # só na primeira vez (npm install -g firebase-tools)
npm run deploy:rules
```

### 5. Usuários de teste
Os usuários de teste **já existem** no projeto. Use a senha da tabela do passo 7 em `DEV_USERS_PASSWORD` e **não** rode o seed à toa: ele redefine a senha de todos para o valor do seu `.env`.
Só se eles ainda não existirem (projeto novo):
```bash
npm run seed:dev
```

### 6. Rodar
```bash
npm run dev
```
Espere aparecer `Ready` e abra **http://localhost:3000**. O mesmo comando sobe a API em http://localhost:8000 (http://localhost:8000/health deve mostrar `{"status":"ok"}`). O comando **fica rodando** enquanto você usa o site; para parar, aperte **Ctrl+C**. Comandos extras (como o `deploy:rules`) vão em outro terminal.

Mudou algum `.env`? Pare e rode `npm run dev` de novo (ele só lê os `.env` ao iniciar).

### 7. Entrar com os usuários de teste
Em http://localhost:3000/entrar, **escolha "Professor" ou "Aluno"** e entre. Todos usam a mesma senha:

| Papel | E-mail | Senha |
|---|---|---|
| **Professor** | `professor.teste@echodev.test` | `yNOcU_gm3PjPuJ8J` |
| **Aluno** | `estudante1.teste@echodev.test` | `yNOcU_gm3PjPuJ8J` |
| Outros alunos | `estudante2.teste@echodev.test` … `estudante8.teste@echodev.test` | `yNOcU_gm3PjPuJ8J` |

Contas novas criadas em "Criar conta" viram **aluno**. Quem escolher "Professor" com um e-mail fora da lista de professores recebe um aviso e não entra. Para autorizar um professor de verdade: `npm run teacher:add -- pessoa@escola.br`.

### 8. Roteiro de teste
Use uma **janela anônima** (Ctrl+Shift+N) para o aluno: cada janela guarda um login.

**Aula ao vivo**
1. **Professor**: clique em **Nova aula**, dê um título e crie. Anote o código de 6 caracteres.
2. **Aluno** (janela anônima): digite o código em **Entrar em uma aula** e aceite os consentimentos.
3. *(Opcional, espanhol)* **Aluno**: escolha **Español**. **Professor**: clique em **Ativar tradução para espanhol** (Chrome 138+; ele baixa o idioma uma vez).
4. **Professor**: clique em **Usar aula de demonstração** (22 frases prontas sobre Git e React) ou em **Iniciar transcrição** (microfone).
5. **Aluno**: as frases chegam ao vivo, com "comiti" corrigido para **commit**. Toque num termo destacado e responda "Essa explicação ajudou?". Em espanhol, o jargão continua igual: "commit", "push", "pull request".

**Depois da aula (IA)**
6. **Professor**: **Encerrar aula** (com o Gemini, leva até 1 minuto) → **Revisar e aprovar**.
7. Revise e **aprove** o resumo, o quiz e o **glossário**: os termos técnicos novos que a IA encontrou na aula (além dos 40 do dicionário), com explicação em português e espanhol. Ao aprovar o glossário, eles entram no dicionário.
8. **Aluno**: clique em **Ver resumo e quiz**: resumo, quiz, glossário e o PDF.

**O dicionário que aprende**
9. **Professor**: crie **outra aula** e rode a demonstração de novo. Os termos aprovados no passo 7 (por exemplo, "componente") agora aparecem **destacados** na legenda; toque para ver a explicação.

### Se algo der errado
- **"E-mail ou senha incorretos"**: confira a senha da tabela; se os usuários não existirem, rode `npm run seed:dev`.
- **"Este e-mail não está autorizado como professor"**: entre marcando **Aluno**, ou autorize o e-mail com `npm run teacher:add -- email`.
- **"O login ainda não foi configurado"**: falta o `web/.env.local` (passo 3).
- **Resumo e quiz sempre iguais**: a API está em `LLM_PROVIDER=mock`; veja a IA no passo 3 e reinicie o `npm run dev`.
- **"Cota gratuita do Gemini esgotada"**: o limite grátis do dia acabou (a API já tenta um segundo modelo); use **Tentar de novo** mais tarde.
- **"Não foi possível adicionar os termos ao dicionário"** ou erro ao aprovar o glossário: as regras do banco estão desatualizadas; rode `npm run deploy:rules`.
- **"Port 3000 is in use"** ou "Another next dev server is already running": já existe um `npm run dev` aberto; use aquele ou feche-o.
- **Erro em "Minhas aulas" logo depois do deploy das regras**: os índices ainda estão sendo criados; espere alguns minutos.
- **Outros erros**: veja as linhas `[api]` no terminal e o console do navegador (F12).

### Sem acesso ao Firebase (modo local)
Tudo roda no seu computador, com usuários de teste próprios e sem tocar no projeto real. Precisa do **Java 21** e do Firebase CLI (`npm install -g firebase-tools`).
1. Faça os passos 1 e 2.
2. Copie os três `.env` do passo 3, sem a chave da conta de serviço. No `web/.env.local`, use `NEXT_PUBLIC_FIREBASE_PROJECT_ID=echodev-eb4fb` e qualquer texto em `NEXT_PUBLIC_FIREBASE_API_KEY` e `NEXT_PUBLIC_FIREBASE_APP_ID` (os emuladores não conferem). No `.env` da raiz, preencha `DEV_USERS_PASSWORD` (12+ caracteres): essa será a senha dos usuários de teste locais.
3. Rode:
   ```bash
   npm run dev:emulators
   ```
   Ele sobe os emuladores, cria os usuários de teste, a API e o site. Painel dos emuladores: http://127.0.0.1:4000.

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
