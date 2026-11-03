# Hospedagem (não feita; guia para a equipe)

Nada foi publicado. Este documento compara as opções para quando tudo estiver rodando localmente. Os limites de planos gratuitos mudam com frequência e as fontes consultadas em 03/11/2026 nem sempre concordam: **confira a página oficial de preços antes de decidir.**

## O que precisa ser hospedado
| Parte | Onde | Observação |
|---|---|---|
| `web/` (Next.js) | **Vercel** (recomendado) | Variáveis `NEXT_PUBLIC_*`. Precisa de HTTPS para o microfone e a Web Speech API funcionarem fora do `localhost`. |
| `api/` (FastAPI) | uma das opções abaixo | Variáveis do `api/.env`. `WEB_ORIGIN` = URL exata da Vercel (sem `*`). |
| Banco, Auth, Realtime | Supabase (já existe) | Adicionar a URL da Vercel em Authentication → URL Configuration. |

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
- **Limpeza de 24 h**: se o `pg_cron` não estiver ativo no Supabase (veja o aviso ao colar o `bundle.sql`), configure um agendador externo (por exemplo, um cron job do próprio Render ou do GitHub Actions) para `POST https://SUA-API/cron/purge` com o cabeçalho `X-Cron-Secret: <CRON_SECRET>` a cada hora.

## Passo a passo resumido (Render + Vercel)
1. Vercel: importar o repositório, **Root Directory = `web`**, preencher `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (URL da API), `NEXT_PUBLIC_DEV_LOGIN=false`.
2. Render: novo Web Service, **Root Directory = `api`**, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; variáveis do `api/.env.example` com `WEB_ORIGIN=https://SEU-APP.vercel.app` e `ENVIRONMENT=production`.
3. Supabase: incluir `https://SEU-APP.vercel.app/**` nas Redirect URLs; configurar SMTP próprio para o link por e-mail (o padrão tem limite baixo de envios).
4. Testar no celular: abrir a URL da Vercel, entrar numa aula e conferir `?debug=1`.

## Fontes consultadas (03/11/2026)
- Render: [changelog sobre WebSocket e spin-down](https://render-www.onrender.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages), [discussão sobre sleep](https://github.com/orgs/community/discussions/197645)
- Vercel: [limites de Functions](https://vercel.com/docs/functions/limitations)
- Railway: [planos](https://docs.railway.com/pricing/plans.md), [fórum sobre Hobby](https://station.railway.com/questions/hobby-plan-1048ca8f)
- Fly.io: [gestão de custos](https://fly.io/docs/about/cost-management/)
