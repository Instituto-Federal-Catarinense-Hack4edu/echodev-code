# Configuração manual (Firebase)

Passo a passo para ligar o EchoDev ao projeto Firebase **echodev-eb4fb**. O código já está pronto; estes passos só você pode fazer, porque exigem a sua conta Google.

> Não rode `firebase init`: os arquivos `firebase.json`, `.firebaserc`, `firestore.rules` e `firestore.indexes.json` já estão no repositório e o `init` pode sobrescrevê-los.

## 1. Console do Firebase (console.firebase.google.com)
1. **Authentication → Começar → Método de login**: ative **E-mail/senha**. O Google é opcional; se ativar, coloque `NEXT_PUBLIC_GOOGLE_LOGIN=true` no `web/.env.local`.
2. **Authentication → Configurações → Domínios autorizados**: `localhost` já vem incluído. Quando publicar o site, adicione o domínio dele.
3. **Firestore Database → Criar banco de dados**: modo de produção, região `southamerica-east1` (São Paulo). A região não pode ser trocada depois.
4. **Configurações do projeto → Contas de serviço → Gerar nova chave privada**. Salve o arquivo como `api/firebase-service-account.json`; o nome já está no `.gitignore`. Nunca mande esse arquivo por chat nem faça commit dele.
5. (Opcional) **Authentication → Modelos → Redefinição de senha → Personalizar URL de ação**: `http://localhost:3000/redefinir-senha` (troque pelo domínio publicado depois). Sem isso, o link do e-mail abre a página padrão do Firebase, que também funciona.

## 2. Terminal
```bash
firebase login
npm run deploy:rules        # envia firestore.rules e os índices
```
O `deploy:rules` roda `firebase deploy --only firestore`. Os índices levam alguns minutos para ficar prontos; durante esse tempo, a lista "Minhas aulas" pode dar erro.

## 3. Arquivos `.env` (já criados nesta máquina, fora do git)
| Arquivo | O que conferir |
|---|---|
| `web/.env.local` | Configuração web do Firebase (pública). `NEXT_PUBLIC_FIREBASE_EMULATORS=false` usa o projeto real. |
| `api/.env` | `FIREBASE_PROJECT_ID=echodev-eb4fb` e `FIREBASE_CREDENTIALS_FILE=firebase-service-account.json` (caminho relativo a `api/`). |
| `.env` (raiz) | `FIREBASE_CREDENTIALS_FILE=api/firebase-service-account.json`, `DEV_USERS_PASSWORD` (senha dos usuários de teste). |

Os modelos estão em `web/.env.example`, `api/.env.example` e `.env.example`.

## 4. Usuários
```bash
npm run seed:dev                          # 1 professor + 8 estudantes de teste, e-mail já confirmado
npm run teacher:add -- pessoa@escola.br   # autoriza um professor de verdade
```
O papel (professor ou aluno) é decidido pela lista `teacherAllowlist`, que só a API e os scripts leem. Quem cria a conta pelo site precisa confirmar o e-mail antes de entrar.

## 5. Rodar
```bash
npm run dev            # site (localhost:3000) + API (localhost:8000) no projeto real
npm run dev:emulators  # tudo local, com emuladores e usuários de teste (não toca no projeto real)
```
No modo emulador, o painel dos emuladores fica em http://127.0.0.1:4000.

## 6. Limpeza de 24 h
As frases são apagadas pela rota `POST https://SUA-API/cron/purge` (cabeçalho `X-Cron-Secret: <CRON_SECRET do api/.env>`), que precisa ser chamada a cada hora por um agendador (veja `docs/DEPLOY.md`). A política de TTL do Firestore faria isso sozinha, mas exige o plano Blaze (faturamento ativo); no plano gratuito o deploy recusa o TTL.

## 7. Testes das regras de acesso
```bash
npm run test:rules     # sobe o emulador do Firestore e prova firestore.rules (15 grupos de casos)
```
