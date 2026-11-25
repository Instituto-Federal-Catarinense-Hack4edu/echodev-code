# Hospedagem

Caminho escolhido: **site na Vercel e API no Render, os dois no plano gratuito** (passo a passo abaixo). Este documento também compara as outras opções. Os limites de planos gratuitos mudam com frequência e as fontes consultadas em 03/11/2026 nem sempre concordam: **confira a página oficial de preços antes de decidir.**

## O que precisa ser hospedado
| Parte | Onde | Observação |
|---|---|---|
| `web/` (Next.js) | **Vercel** (recomendado) | Variáveis `NEXT_PUBLIC_*`. Precisa de HTTPS para o microfone e a Web Speech API funcionarem fora do `localhost`. |
| `api/` (FastAPI) | uma das opções abaixo | Variáveis do `api/.env`. `WEB_ORIGIN` = URL exata da Vercel (sem `*`). |
| Banco, login, tempo real | Firebase (projeto `echodev-eb4fb`) | `npm run deploy:rules` envia as regras e os índices. Adicionar o domínio da Vercel em Authentication → Configurações → Domínios autorizados. |

## Opções para a API Python
| Host | Limite de tempo por requisição | "Dorme"? | Observações |
|---|---|---|---|
| **Render** (Web Service) | sem limite curto | Plano gratuito dorme após ~15 min sem tráfego; acordar leva ~30–60 s | Mais simples para FastAPI (comando `uvicorn app.main:app --host 0.0.0.0 --port $PORT`). Plano pago básico não dorme. |
| **Vercel** (Functions Python) | Hobby: 300 s (padrão e máximo) | Cold start curto por função | Mesmo painel do `web/`. 300 s cobre a chamada ao LLM (timeout do cliente: 90 s). Exige adaptar a entrada ASGI conforme a documentação da Vercel. |
| **Railway** | sem limite curto | Só se o serviço for marcado como "serverless" (relatos de ~10 min) | Teste com crédito único; depois plano Hobby pago. |
| **Fly.io** | sem limite curto | Auto stop/start configurável | Contas novas não têm mais franquia gratuita (só teste); máquina parada ainda cobra armazenamento. |

### Recomendação para o hackathon
- **Render (gratuito) + mitigação de cold start**, ou **Vercel Functions** se a equipe preferir um painel só.
- A mitigação de "dormir" já está no código (armadilha 18):
  - a tela ao vivo do professor chama `GET /health` ao abrir e **a cada 5 minutos** durante a aula;
  - a tela de revisão chama `/health` ao abrir;
  - o navegador espera até 120 s pela API e mostra "Gerando… isso pode levar até 1 minuto";
  - se o LLM falhar, a aula continua encerrada e o botão "Tentar de novo" chama `regenerate`.
- **Limpeza de 24 h** (obrigatória: no plano gratuito do Firebase não há TTL): configure um agendador externo (por exemplo, um cron job do próprio Render ou do GitHub Actions) para `POST https://SUA-API/cron/purge` com o cabeçalho `X-Cron-Secret: <CRON_SECRET>` a cada hora.

## Passo a passo (Render + Vercel)
Antes: o código precisa estar no GitHub, na branch que será publicada. Faça os passos na ordem, porque cada serviço precisa do endereço do outro.

### 1. API no Render (render.com)
1. Entre com a conta do GitHub e autorize o acesso ao repositório `echodev-code`.
2. **New → Blueprint**, escolha o repositório e a branch. O Render lê o `render.yaml` da raiz e cria o serviço `echodev-api` (plano gratuito, pasta `api`).
3. Ele pede os valores secretos: `GEMINI_API_KEY` (a chave do AI Studio) e `WEB_ORIGIN` (por enquanto `http://localhost:3000`; troque no passo 3). O `CRON_SECRET` é gerado sozinho.
4. No serviço criado: **Environment → Secret Files → Add Secret File**, nome `firebase-service-account.json`, conteúdo = o arquivo `api/firebase-service-account.json` inteiro. Salve; o Render publica de novo.
5. Anote o endereço do serviço (ex.: `https://echodev-api.onrender.com`) e confira que `https://…/health` responde `{"status":"ok"}`.

### 2. Site na Vercel (vercel.com)
1. Entre com a conta do GitHub, **Add New → Project**, importe o repositório.
2. **Root Directory = `web`** (o resto a Vercel detecta: Next.js).
3. Em **Environment Variables**, copie do `web/.env.local`: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, e acrescente `NEXT_PUBLIC_FIREBASE_EMULATORS=false` e `NEXT_PUBLIC_API_URL=<endereço do Render>`.
4. **Deploy**. Anote o endereço (ex.: `https://echodev.vercel.app`).

### 3. Ligar um ao outro
1. Render → `echodev-api` → **Environment**: troque `WEB_ORIGIN` pelo endereço da Vercel (sem barra no fim).
2. Firebase → **Authentication → Configurações → Domínios autorizados → Adicionar domínio**: o domínio da Vercel (sem `https://`).

### 4. Limpeza de 24 h (GitHub Actions)
No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
- `ECHODEV_API_URL` = endereço do Render;
- `ECHODEV_CRON_SECRET` = o `CRON_SECRET` que o Render gerou (Render → Environment).

O workflow `.github/workflows/purge.yml` chama `POST /cron/purge` a cada hora. Para testar na hora: **Actions → Limpeza de 24 h → Run workflow**.

### 5. Testar
1. No celular, abra o endereço da Vercel, entre como aluno numa aula e confira `?debug=1`.
2. Do computador, com a API publicada: `node scripts/py.mjs scripts/e2e_lesson.py --api https://echodev-api.onrender.com`.
3. A primeira requisição depois de 15 min parada leva até ~1 min (o Render acorda o serviço). Abra a tela da aula uns minutos antes de começar: ela mantém a API acordada.

### Heroku (alternativa)
Não tem mais plano gratuito: o plano Eco custa US$ 5/mês (1.000 horas divididas entre os apps da conta, que também dormem). Com o GitHub Student Developer Pack, o Heroku dá US$ 13/mês em créditos. Funciona, mas pede mais configuração (dois apps, um por pasta) e não traz vantagem sobre Render + Vercel para este projeto.
## Fontes consultadas (03/11/2026)
- Render: [changelog sobre WebSocket e spin-down](https://render-www.onrender.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages), [discussão sobre sleep](https://github.com/orgs/community/discussions/197645)
- Vercel: [limites de Functions](https://vercel.com/docs/functions/limitations)
- Railway: [planos](https://docs.railway.com/pricing/plans.md), [fórum sobre Hobby](https://station.railway.com/questions/hobby-plan-1048ca8f)
- Fly.io: [gestão de custos](https://fly.io/docs/about/cost-management/)
