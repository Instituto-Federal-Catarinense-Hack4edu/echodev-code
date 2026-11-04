# Decisões

Registro de escolhas tomadas durante a construção (o que, por quê).

## Fase 0
- **Ambiente Windows.** A máquina de desenvolvimento é Windows 11; o venv fica em `api/.venv/Scripts/`. Criei `scripts/py.mjs`, que encontra o Python do venv em Windows (`Scripts/python.exe`) ou macOS/Linux (`bin/python`), para os scripts da raiz funcionarem nos dois.
- **Next.js 16.4.4** (o que `create-next-app` entregou). Nesta versão `middleware.ts` foi renomeado para `proxy.ts`; uso `proxy.ts` para renovar a sessão do Supabase.
- **shadcn 4.23 com preset padrão `base-nova`** (componentes sobre `@base-ui/react`, não Radix). Mantido, sem downgrade.
- **Sem `@vitejs/plugin-react` nem Testing Library**: conflitavam com dependências do shadcn, e os testes do MVP são de lógica pura (corretor, transporte, estado do cliente). Vitest roda em ambiente `node` (que já tem `BroadcastChannel`).
- **`@types/node` na linha 22** (exigência do Vitest 5 e igual ao Node instalado).
- **`npm run check` inclui `check:types`**: gera o `openapi.json` e falha se `web/src/lib/api/schema.d.ts` estiver desatualizado (armadilha 23).
- **`LLM_MODEL` no `.env.example` = `claude-sonnet-5-5`** (modelo atual da Anthropic; confirmado novamente na Fase 3).

## Fase 1
- **Campo extra `forms` no termo**: flexões legítimas (plural, "variáveis") são destacadas mas **não** trocadas, para não estragar a gramática. `variants` continuam sendo erros de reconhecimento trocados pelo `canonical`.
- **Correspondência por tokens colados**: além de "use state" literal, o corretor compara a junção dos tokens ("usestate") com a junção do termo, então "use state" vira "useState" mesmo sem a variação escrita. Tokens só se juntam se entre eles houver espaço ou hífen (nunca vírgula).
- **Maiúscula inicial preservada**: se o termo canônico é minúsculo e só a caixa difere ("Commit" no início da frase), o texto falado fica como está.
- **Categorias** do pacote: `conceitos`, `git`, `web`, `ferramentas`.
- **Histórico no modo offline**: o `LocalTransport` tem um pedido/resposta de histórico pelo próprio BroadcastChannel; a aba do professor responde. Assim a aba do estudante aberta depois recupera as frases, como a recuperação por `seq` do Supabase.
- **`lastSeq`** = maior `seq` tal que todos de 1 até ele estão presentes. Mensagens além de uma lacuna já aparecem na tela; a recuperação preenche o buraco.
- **Palavras por minuto**: janela móvel de 60 s, com mínimo de 10 s de janela para não explodir na primeira frase.
- **Folha inferior sem desfoque** do fundo (alterado em `components/ui/sheet.tsx`) para a legenda continuar legível com a explicação aberta.
- **Alvos de toque**: todo `[data-slot=button]` tem no mínimo 44×44 px (em `globals.css`).

## Fase 2
- **Chaves novas do Supabase** (`sb_publishable_`/`sb_secret_`): conforme a documentação, a chave vai no cabeçalho `apikey` e nunca como `Authorization: Bearer` (não são JWTs). A chave secreta é recusada por navegadores. Requisições de usuário usam `apikey` = publicável + `Authorization: Bearer <token do usuário>`.
- **Scripts administrativos com `httpx`** (Auth Admin e PostgREST) em vez do `supabase-py`, que fica só como dependência da biblioteca `realtime` usada no `check_rls`. Menos camadas, mesmo comportamento.
- **`literal_mode` no perfil** (coluna extra) para guardar o "modo literal" da Fase 4. _Atualização 03/11/2026: o modo foi retirado; a coluna (e `mode`) ficam no banco sem uso, para não exigir migração._
- **`join_lesson` exige os dois consentimentos obrigatórios** no próprio banco (defesa em profundidade, além da tela).
- **Mínimo de 3 estudantes no relatório é um piso**: `lesson_term_report` usa `greatest(p_min_students, 3)`, então ninguém consegue pedir 1 e desanonimizar.
- **Frases vencidas ficam invisíveis já pela RLS** (`expires_at > now()`), mesmo antes da limpeza rodar.
- **Exclusão de dados em duas etapas**: `delete_my_data()` (token do usuário) apaga eventos, vínculos e consentimentos; a conta em si será apagada pela API com a chave secreta (Fase 4).
- **Proteção de rotas no `proxy.ts`** (redireciona sem sessão) e papel de professor checado no cliente; a segurança real é a RLS. Evita `cookies()` em layouts, que com Cache Components exigiria Suspense em tudo.
- **`allowedDevOrigins: ["127.0.0.1"]`** (mais `DEV_ORIGINS` opcional) para testar duas sessões no mesmo navegador e abrir pelo celular na rede local em desenvolvimento.
- **Validação local do SQL com `pgserver`** (Postgres embutido via pip): o Docker Desktop desta máquina não iniciou. `npm run db:validate` usa esquemas `auth`/`realtime` mínimos; não substitui o `check:rls` no projeto real.
- **`pg_cron`**: a migração tenta ativar e agenda a limpeza de hora em hora; se não der, a rota `POST /cron/purge` (Fase 3) é o plano B.

## Fase 3
- **Sem "temperatura baixa"**: a API atual da Anthropic recusa `temperature`/`top_p`/`top_k` (400 desde 21/10/2026). A fidelidade vem do prompt ("use somente o que foi dito"), do esquema JSON em `output_config.format` e de `effort` configurável (`LLM_EFFORT=medium`).
- **Modelo padrão `claude-opus-5-5`** (recomendação atual da Anthropic), trocável por `LLM_MODEL`.
- **`fallbacks: "default"` ligado por padrão** (`LLM_FALLBACKS=true`): se o modelo recusar por engano, a API reenvia a outro modelo na mesma chamada. Exige o endpoint beta; pode ser desligado.
- **Contagens validadas pelo Pydantic, não pelo esquema JSON**: o esquema enviado ao modelo é simples (formato), e as regras de quantidade disparam a única nova tentativa com o erro.
- **Idempotência de `end`**: se já existem materiais, devolve os existentes sem chamar o LLM. Se a aula foi encerrada mas o LLM falhou, chamar `end` de novo (ou `regenerate`) gera.
- **Material novo com `insert`, existente com `update`**: um upsert exigiria permissão de UPDATE em `lesson_id`/`kind`, que de propósito não existe.
- **Termos sem definição**: procura "significa", "serve para", "é um/uma", "quer dizer", "ou seja" no resto da frase da primeira menção e nas 3 frases seguintes. "é um" exige o acento, para não confundir com "e um".
- **"3 trechos mais rápidos" = 3 minutos com maior média de palavras/min** (sem texto, para sobreviver à limpeza de 24 h).
- **`regenerate` responde 409** quando há material aprovado, quando a aula não foi encerrada ou quando a transcrição já expirou.

## Fase 4
- **Preferências no perfil para quem está logado; no aparelho (`localStorage`) só no modo demonstração.**
- **Correções de termo valem para todos os professores** (a tabela não guarda autor, por privacidade); o professor só insere e lê.
- **`WEB_ORIGIN` aceita lista de origens exatas separadas por vírgula** (sem `*`), para `localhost` e `127.0.0.1` ou o IP da rede local no desenvolvimento.
- **Revogar um consentimento obrigatório** não expulsa da aula em andamento; impede entrar em novas aulas (`join_lesson` checa).
- **Aviso de fim de aula ao estudante conectado** não foi feito (o estudante descobre ao tentar entrar de novo ou pelo link de revisão). Registrado em "Ideias fora do escopo".

## Fase 5
- **`load_test.py` ficou em Python** (a biblioteca `realtime` funcionou bem no `check_rls`); não foi preciso a exceção em Node. Os 40 clientes reaproveitam as 8 contas de teste (5 conexões cada), porque cada conexão precisa ser de um membro da aula.
- **Ícones gerados por script** (PNG 192/512, sem dependências) e manifest via `app/manifest.ts`. Sem service worker, como pedido.
- **`/health` a cada 5 minutos na tela ao vivo**: hosts gratuitos dormem após ~15 min sem tráfego, e uma aula dura mais que isso.
- **Painel de depuração** só mostra a latência como indicação (relógios diferentes entre aparelhos, armadilha 34).

## Ajustes de 03/11/2026 (pedido da equipe)
- **Modo único**: retirados "modo calmo" e "ao pé da letra". A tradução literal de termos figurativos aparece sempre na explicação; o movimento reduzido segue o sistema do aparelho. Uma experiência só para todos, coerente com o lema.
- **Aviso de fim de aula no canal** (mensagem `lesson_ended`, validada com Zod): a regra de RLS existente já garante que só o professor dono publica. Reforço por checagem de status na reconexão e a cada 30 s.
- **Tela de revisão do estudante atualiza sozinha** a cada 15 s enquanto falta material aprovado (polling simples em vez de Realtime de banco, para não abrir outro canal).

## Ajustes de 03/11/2026, parte 2 (pedido da equipe)
- **Correção aproximada no corretor** (opção 2 da melhoria de transcrição): depois de tentar o dicionário exato, aceita grafias a 1 letra de distância (2 em termos de 9+ letras) para palavras de 5+ letras, com a mesma primeira letra; troca de letras vizinhas conta como 1. Pares de palavras só contra termos de duas palavras ("use effect", "pull request"), palavra a palavra, e nunca engolindo uma palavra que já é termo (o teste pegou "com git" virando "commit"). Empate entre termos não troca nada. Termos que são palavras do português (`"fuzzy": false` no pacote) e uma lista de bloqueio ("branco", "comitê", "retorno"...) ficam de fora. Teste garante que a aula de demonstração sai idêntica com e sem a correção aproximada.
- **Filtro de palavrões no navegador do professor**, antes do corretor: o palavrão vira `***` na legenda, no banco, no resumo e no que vai ao LLM. Lista explícita (pt-BR + inglês), palavra inteira, sem acento e sem maiúsculas; palavras com sentido comum ("pica" de picar, "bicha") ficam de fora para evitar falsos positivos. Curadoria da lista: `web/src/lib/text/profanity.ts`.
- **PDF gerado no navegador (jsPDF 4.2.1)**, não na API: funciona mesmo com a API dormindo e não exige outra rota. Estudante: resumo + glossário dos termos-chave (explicação curta do pacote). Professor: o mesmo + quiz com gabarito, a partir do que está na tela de revisão. Fontes padrão do PDF (acentos ok); símbolos fora delas são trocados ("→" vira "->").
