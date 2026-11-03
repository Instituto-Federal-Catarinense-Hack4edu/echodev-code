# Configuração manual (só a Vitória pode fazer)

Passos que exigem conta, senha ou painel. Cada um diz como saber que deu certo.

## 1. Criar o projeto no Supabase e copiar as chaves
1. Em https://supabase.com/dashboard, crie um projeto (região mais próxima, por exemplo São Paulo). Guarde a senha do banco num gerenciador de senhas.
2. Abra **Project Settings → API Keys** (o nome do menu pode variar um pouco). Copie:
   - a **URL do projeto** (`https://xxxx.supabase.co`, também aparece no botão "Connect");
   - a chave **pública** (`publishable` nova, ou `anon` na aba de chaves antigas);
   - a chave **secreta** (`secret` nova, ou `service_role` antiga). Ela dá acesso total: nunca vai para o navegador nem para o git.
3. Crie os arquivos a partir dos exemplos e cole os valores:
   - `web/.env.local` (de `web/.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a pública), `NEXT_PUBLIC_DEV_LOGIN=true` para testes.
   - `api/.env` (de `api/.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (a secreta), `CRON_SECRET` (qualquer texto longo e aleatório).
   - `.env` na raiz (de `.env.example`): mesmas três do Supabase e uma `DEV_USERS_PASSWORD` (senha dos usuários de teste).

**Deu certo se:** os três arquivos existem e `git status` não mostra nenhum deles.

## 2. Criar as tabelas (depois que a Fase 2 gerar o `supabase/bundle.sql`)
1. No painel, abra **SQL Editor → New query**.
2. Cole o conteúdo inteiro de `supabase/bundle.sql` e clique em **Run**.

**Deu certo se:** em **Table Editor** aparecem `profiles`, `lessons`, `utterances` etc., todas com o selo de RLS ativa.

## 3. Cadastrar o e-mail de professor
No SQL Editor, rode (troque pelo seu e-mail):

```sql
insert into public.teacher_allowlist (email) values ('seu-email@exemplo.com');
```

**Deu certo se:** ao entrar no EchoDev com esse e-mail, aparece a área do professor. (Se você já tinha entrado antes do insert, rode também o `update` que a Fase 2 vai documentar aqui.)

## 4. Opcional: login e e-mail
- **URLs de redirecionamento**: em **Authentication → URL Configuration**, Site URL `http://localhost:3000` e, em Redirect URLs, `http://localhost:3000/**` (e depois a URL da Vercel).
- **Google**: em **Authentication → Providers → Google**, siga o passo a passo do próprio painel.
- **SMTP próprio**: o envio padrão de links por e-mail tem limite baixo por hora. Para a demo real, configure em **Authentication → Emails → SMTP Settings** (por exemplo, com um serviço transacional). Para testes, use o login de desenvolvimento por senha.

## 5. Opcional: chave do LLM
Crie uma chave em https://console.anthropic.com e coloque em `api/.env` (`ANTHROPIC_API_KEY`, `LLM_PROVIDER=anthropic`). Sem ela, deixe `LLM_PROVIDER=mock`: tudo funciona com resumo e quiz fixos.

## 6. Opcional: hospedagem da API Python
Decisão depois que tudo rodar localmente. Veja `docs/DEPLOY.md` (Fase 5).
