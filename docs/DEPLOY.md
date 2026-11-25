# Hospedagem

Caminho escolhido: **tudo na Vercel, plano gratuito (Hobby)**: dois projetos do mesmo repositório, um para o site (pasta `web`) e outro para a API (pasta `api`). Passo a passo abaixo; o resto do documento compara as outras opções. Os limites de planos gratuitos mudam com frequência e as fontes consultadas em 03/11/2026 nem sempre concordam: **confira a página oficial de preços antes de decidir.**

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

## Passo a passo (tudo na Vercel)
Antes: o código precisa estar no GitHub, na branch que será publicada (de preferência o `main`). Faça na ordem: a API primeiro, porque o site precisa do endereço dela.

### 1. API (projeto `echodev-api` na Vercel)
1. Entre em vercel.com com a conta do GitHub → **Add New → Project** → importe `echodev-code`. Se a organização do GitHub pedir, um dono dela precisa aprovar o acesso da Vercel.
2. **Project Name** = `echodev-api`, **Root Directory** = `api`. A Vercel reconhece o FastAPI sozinha (`app/main.py`, variável `app`); o `api/vercel.json` dá até 300 s por pedido e deixa testes e arquivos locais de fora.
3. **Environment Variables** (os valores secretos nunca vão para o GitHub):

   | Nome | Valor |
   |---|---|
   | `FIREBASE_PROJECT_ID` | `echodev-eb4fb` |
   | `FIREBASE_CREDENTIALS_JSON` | o conteúdo inteiro do arquivo da conta de serviço (abra o JSON no Bloco de Notas, copie tudo e cole) |
   | `WEB_ORIGIN` | por enquanto `http://localhost:3000` (troque no passo 3) |
   | `CRON_SECRET` | um texto aleatório comprido (por exemplo, gere com um gerador de senhas, 32 caracteres) |
   | `LLM_PROVIDER` | `gemini` |
   | `LLM_MODEL` | `gemini-3.1-flash-lite` |
   | `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash-lite,gemini-3.6-flash` |
   | `GEMINI_API_KEY` | a chave do aistudio.google.com |
   | `ENVIRONMENT` | `production` |

4. **Deploy**. Anote o endereço (ex.: `https://echodev-api.vercel.app`) e confira que `https://…/health` responde `{"status":"ok"}`.

### 2. Site (projeto `echodev` na Vercel)
1. **Add New → Project** → importe o mesmo repositório de novo.
2. **Project Name** = `echodev`, **Root Directory** = `web` (Next.js é detectado).
3. **Environment Variables**: copie do `web/.env.local` os `NEXT_PUBLIC_FIREBASE_*` (API key, auth domain, project id, app id, storage bucket, messaging sender id), mais `NEXT_PUBLIC_FIREBASE_EMULATORS=false` e `NEXT_PUBLIC_API_URL=<endereço da API, sem barra no fim>`.
4. **Deploy**. Anote o endereço (ex.: `https://echodev.vercel.app`).

### 3. Ligar um ao outro
1. Vercel → projeto `echodev-api` → **Settings → Environment Variables**: troque `WEB_ORIGIN` pelo endereço do site (sem barra no fim) e depois **Deployments → ⋯ → Redeploy** (variável nova só vale num deploy novo).
2. Firebase → **Authentication → Configurações → Domínios autorizados → Adicionar domínio**: o domínio do site (sem `https://`).

### 4. Limpeza de 24 h (GitHub Actions)
No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
- `ECHODEV_API_URL` = endereço da API;
- `ECHODEV_CRON_SECRET` = o mesmo `CRON_SECRET` do passo 1.

O workflow `.github/workflows/purge.yml` chama `POST /cron/purge` a cada hora. Para testar na hora: **Actions → Limpeza de 24 h → Run workflow**.

### 5. Testar
1. No celular, abra o endereço do site, entre como aluno numa aula e confira `?debug=1`.
2. Do computador: `node scripts/py.mjs scripts/e2e_lesson.py --api https://echodev-api.vercel.app` (aula completa pelas regras, apagada no fim).

### Por que Vercel e não Render ou Heroku
- **Render** gratuito "dorme" depois de 15 min sem uso e leva até ~1 min para acordar; na Vercel a função da API acorda em segundos.
- **Heroku** não tem plano gratuito (Eco: US$ 5/mês; estudantes do GitHub Student Pack ganham crédito mensal).
- Limites da Vercel Hobby que importam aqui: 300 s por pedido (encerrar a aula leva ~10–30 s), 500 MB para a API em Python (as dependências medem ~114 MB), uso não comercial.
## Fontes consultadas (03/11/2026 e 25/11/2026)
- Vercel: [FastAPI na Vercel](https://vercel.com/docs/frameworks/backend/fastapi), [Python nas Functions](https://vercel.com/docs/functions/runtimes/python), [limites](https://vercel.com/docs/functions/limitations)
- Render: [changelog sobre WebSocket e spin-down](https://render-www.onrender.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages), [discussão sobre sleep](https://github.com/orgs/community/discussions/197645)
- Vercel: [limites de Functions](https://vercel.com/docs/functions/limitations)
- Railway: [planos](https://docs.railway.com/pricing/plans.md), [fórum sobre Hobby](https://station.railway.com/questions/hobby-plan-1048ca8f)
- Fly.io: [gestão de custos](https://fly.io/docs/about/cost-management/)
