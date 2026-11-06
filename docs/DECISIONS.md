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

## Identidade visual (04/11/2026)
- **Logo da equipe** em `web/public/brand/` (logo completa e símbolo recortados da imagem enviada; ícones do app, ícone com margem para Android, ícone Apple e favicon gerados a partir do símbolo).
- **Paleta tirada da logo**: ferrugem `#a5400c` como cor principal (contraste ~6,6:1 no branco, AA), papel `#f4f1e9` nos fundos suaves, tinta `#17181c` no texto; termos destacados em pêssego claro `#f6dccb` com texto `#5c2306`.
- **Onde aparece**: logo grande na página inicial; cabeçalho com logo nas telas do professor, login, conta, revisão e demonstração; só o símbolo no topo da legenda ao vivo (para não roubar espaço no celular); logo no topo do PDF do resumo (imagem comprimida, PDF ~40 KB).

## Auditoria de 04/11/2026
Corrigido (com teste automático ou verificado no navegador):
- **Reconhecimento duplicado**: um reconhecedor antigo podia reiniciar sozinho depois de pausar e retomar, gerando frases em dobro. Agora só o reconhecedor atual reinicia (`webspeech.test.ts`).
- **Gravar antes de publicar**: cada frase é salva no banco e só então enviada ao canal, em fila e na ordem. Se o `seq` já existir (segunda aba do professor, recarga), a frase é renumerada para depois do maior `seq` salvo e tenta de novo. O que o estudante vê ao vivo é exatamente o que a recuperação devolve. Custo: latência subiu de ~0,03 s para ~0,4 s (meta: 2 s).
- **Encerrar com frase pendente**: o professor para de ouvir e espera a fila esvaziar antes de chamar a API, então nenhuma frase entra depois do relatório. Se a API demorar (tempo limite agora 5 min) ou o LLM falhar, a tela confere o status real da aula antes de mostrar erro.
- **Encerrar pela tela de revisão** (sem parar a transcrição nem avisar estudantes) foi removido; a revisão agora leva à tela ao vivo.
- **Canal ao vivo fora do ar**: o professor vê se o canal está conectado; o estudante busca frases perdidas também a cada 20 s (antes, uma última frase perdida nunca era recuperada).
- **Teste de microfone e reconhecimento ao mesmo tempo**: iniciar a transcrição fica bloqueado enquanto o teste usa o microfone (armadilha 2).
- **Correções de termo perigosas**: recusadas se tiverem menos de 3 letras, forem palavra comum do português, palavrão ou já forem outro termo; correções antigas inválidas são ignoradas ao carregar.
- **Pacote de termos inexistente** no banco não derruba mais a tela (usa o pacote padrão).
- **Contador "estudantes conectados"** na verdade contava quem entrou: rótulo corrigido para "entraram".
- **Relatório** mostra só termos que existem no dicionário (o `term_id` é texto enviado pelo estudante).
- **"Tentar de novo"** pede confirmação (apagava edições não salvas).
- **Data do PDF** é a da aula, não a do download.
- **QR code com `localhost`** mostra aviso (celulares não abrem esse endereço).
- **Botões "Fechar"** dos diálogos estavam em inglês para leitores de tela.
- **Excluir conta de professor** avisa que apaga todas as aulas dele.
- **API**: erros do banco viram 502 legível com cabeçalho CORS (antes, 500 sem CORS aparecia como "erro de rede"); ids validados como UUID (422); segredo do cron comparado em bytes (acento derrubava a rota); encerramento em dobro não quebra mais nem sobrescreve material aprovado; cliente da Anthropic reutilizado; blocos de aulas longas resumidos 3 em paralelo; prompt proíbe nomes de pessoas e trata instruções dentro da transcrição como conteúdo.

Riscos conhecidos que ficaram (sem mudança no banco, para não exigir SQL novo):
- Um estudante pode registrar muitos toques no mesmo termo (o relatório conta estudantes distintos corretamente, mas "toques" pode inflar).
- Códigos de aula podem ser testados por tentativa e erro por quem tem conta (sem limite de taxa); a proteção real é a RLS e a aula encerrada não aceitar entrada.
- O professor pode reabrir uma aula encerrada editando o banco diretamente.

## Controle da transcrição (04/11/2026)
- O painel do professor passou a ter estados explícitos (`lib/stt/control-phase.ts`, com testes): pronto, iniciando (aguardando permissão do microfone), ativa, pausada, demonstração terminou e erro. Cada estado mostra só os botões que fazem sentido.
- Os reinícios automáticos do Chrome entre pausas na fala contam como "ativa"; o aviso de reconexão só aparece se o reinício passar de 4 s.
- Dá para trocar entre microfone e demonstração quando pausado; a demonstração terminada tem "Recomeçar".
- A lista de frases rola sozinha sem mover a página inteira.
- **Início do reconhecimento à prova de travamento** (04/11/2026): antes de ligar o reconhecimento, o EchoDev pede o microfone diretamente (e fecha na hora), o que mostra a pergunta de permissão e distingue "negado", "sem microfone" e "microfone em uso". Se o navegador não começar a ouvir em 8 s (Brave, Opera, navegadores embutidos sem serviço de voz), a tela para de esperar e explica. `audio-capture` virou erro definitivo (antes ficava tentando de novo em silêncio) e uma exceção em `start()` não é mais engolida.

## Contas de verdade (04/11/2026)
- Login principal por **e-mail e senha**, com abas "Entrar" e "Criar conta", "Esqueci minha senha" (`/redefinir-senha`) e mensagens claras por código de erro do Supabase. O link mágico e o quadro "Login de desenvolvimento" saíram; os usuários de teste entram pelo formulário normal.
- **Menu do usuário** no cabeçalho de todas as páginas: e-mail conectado, "Minhas aulas" (só para professor), "Minha conta" e "Sair".
- **Página inicial** separa estudante (código da aula), professor (entrar ou criar conta) e a demonstração offline (recolhida).
- **Quem é professor** continua definido pela `teacher_allowlist`; novo `npm run teacher:add -- email` autoriza e promove contas existentes.
- O projeto Supabase exige confirmação de e-mail (`mailer_autoconfirm: false`): ver `docs/SETUP_MANUAL.md` 3b.

## Papéis separados e painel da aula (04/11/2026)
- **Um e-mail é professor ou aluno, nunca os dois.** Migração `20261104000600_roles.sql`: `join_lesson` recusa conta de professor (`teacher_cannot_join`); promover uma conta a professor apaga os rastros de aluno dela (matrículas e eventos de termo), por gatilho.
- **Áreas separadas**: `/professor/*` e `/aluno` + `/aula/*` passam por `RoleGate`; quem entra na área errada vê um aviso e o link para a própria área. Depois do login cada papel vai para a sua casa (`lib/roles.ts`). Nova página `/aluno` com o código da aula e as aulas que o estudante já entrou.
- **Termo clicável também no console do professor**: abre a mesma ficha que o aluno vê (sem os botões de avaliação, que são só do aluno).
- **Painel da aula** (`/professor/aulas/[id]`): ao encerrar, o professor cai nele. Mostra estudantes, duração, frases e ritmo médio, o estado do resumo e do quiz, o PDF do professor, a prévia do quiz ("Conferir quiz") e o relatório de ritmo e termos. A página `/relatorio` foi absorvida pelo painel.
- Comentários que só repetiam o código foram removidos; ficaram os que explicam um porquê não óbvio.

## Espanhol para alunos hispanofalantes (05/11/2026)
- **Quem**: o professor fala português; o aluno escolhe "Español" e recebe a legenda traduzida, as telas do aluno, as explicações dos 40 termos (curta, exemplo e passo a passo), o resumo, o quiz e o PDF em espanhol.
- **Tradução ao vivo no navegador do professor** com a Translator API do Chrome (138+, só computador). Mantém a regra "ao vivo não passa por Python nem IA externa": nada sai do computador para traduzir. O celular do aluno não tem essa API, por isso a frase já vai traduzida (`utterances.text_es`, apagada junto com a frase em 24 h). Se o tradutor não existir ou não responder em 5 s, o painel avisa e a aula segue só em português.
- **Termos na frase traduzida**: procurados pelo nome em espanhol (`explanations.es.names`), pelo termo canônico e pelas formas; o que não for achado aparece como botão "Términos:" ao lado da frase.
- **Resumo e quiz em espanhol**: na página de revisão, "Traduzir resumo e quiz para espanhol" usa o mesmo tradutor do Chrome e cria `resumo_es` e `quiz_es` como rascunho; o professor revisa e aprova como a versão em português. Código e opções que parecem código não são traduzidos. Funciona com o provedor `mock`, sem chave de IA. A API ignora as versões em espanhol ao gerar de novo.
- **Textos da interface**: exceção à regra "só em `pt-BR.ts`": o espanhol fica em `lib/i18n/es.ts`, que só sobrescreve chaves (o que faltar cai no português). Só telas do aluno usam `useT()`; telas do professor continuam em português. Entrar, Minha conta e Redefinir senha ainda estão só em português.
- Inglês continua só nas explicações curtas dos termos (as telas ficam em português).

## Redesenho de UI/UX (05/11/2026)
- **Só visual e usabilidade**: nenhuma regra de negócio, consulta ou fluxo mudou. As telas usam peças novas em comum (`components/states.tsx`, `status-pill.tsx`, `page-header.tsx`, `copy-button.tsx`, `password-input.tsx`, `theme-toggle.tsx`) e uma superfície padrão (`surface` em `globals.css`).
- **Modo escuro sem `next-themes`**: um script curto em `layout.tsx` (`lib/theme.ts`) aplica a classe `dark` antes da pintura (segue o sistema; a escolha manual fica em `localStorage` `echodev:theme`). Os ícones do botão trocam por CSS, então servidor e cliente renderizam o mesmo HTML. O QR code continua sempre em fundo branco.
- **Paleta escura** derivada da logo (ferrugem clareada `#f0915e`, fundos quentes); a logo é invertida com `hue-rotate` no escuro para o texto ficar legível.
- **Tons de estado** novos (`success`, `warning`, `warning-strong`, `danger-soft`, `live`, `primary-soft`) para avisos, selos e o gráfico de ritmo; cor nunca é o único sinal (sempre há rótulo ou ícone).
- **Novos recursos de UX**: mostrar/esconder senha; copiar código da aula e link do aluno; filtro por status em "Minhas aulas"; contador de caracteres no código e no título da aula; contagem regressiva no teste de microfone; indicador do tamanho da letra; "Essa explicação ajudou?" com ícones; prévia interativa de termo na página inicial; página 404; esqueletos de carregamento.
- **Menu do usuário** com ícones e link ativo destacado; como lê a URL (`usePathname`), fica dentro de `<Suspense>` no `SiteHeader` para as rotas dinâmicas continuarem pré-renderizando (exigência do `cacheComponents`).
- **Bug corrigido**: sem preferência salva, a legenda abria no menor tamanho (18 px), porque `Number(null)` é 0; agora abre no padrão (26 px).
- **Sem menções à demonstração offline na interface** (pedido do usuário em 05/11/2026): a página inicial e o login não levam mais às páginas `/demo/*`, que continuam existindo pelo endereço e no README. Sem Supabase, o login só avisa que não está configurado.

## Migração para o Firebase (05/11/2026, pedido do usuário)
- **Firestore em vez de Postgres; regras em vez de RLS.** `firestore.rules` nega tudo que não está explícito e reproduz as políticas antigas (dono, membro, só aprovado, ninguém lê eventos). Provado por `web/rules-tests/` no emulador.
- **O que eram funções `security definer` virou rota da API** com o Admin SDK: entrar na aula (checa papel, consentimentos e status), contar participantes, relatório por termo (mínimo de 3 alunos, sem pseudônimos na resposta), criar perfil, excluir conta e limpeza. As regras do Firestore não fazem agregações nem leem a allowlist, então isso precisa de servidor. Como o Admin SDK ignora as regras, **cada rota confere quem chama** (`_owned_lesson`, o próprio uid). Isso substitui a regra antiga "API usa o token do usuário"; registrado no `CLAUDE.md`.
- **Membros por pseudônimo** (`lessonMembers/{aula}_{pseudônimo}`, com `lesson_code` para o aluno achar a aula pelo código) e eventos de termo também por pseudônimo. O pseudônimo fica no perfil, que só o dono lê.
- **Código da aula único** com `lessonCodes/{código}` gravado no mesmo lote da aula; código repetido faz as regras recusarem o lote e o site tenta outro (como o antigo erro 23505).
- **Ids de aula são UUID** gerados no navegador (`crypto.randomUUID()`), para a API continuar validando o formato.
- **Canal ao vivo = gravação da frase.** Cada frase é escrita uma vez (`runTransaction`, `seq` como id); repetida volta "duplicate" e o fluxo de renumeração antigo continua valendo. `publish`/`publishControl` do transporte viraram no-op.
- **24 h**: `expires_at` gravado pelo navegador (as regras aceitam de agora até 25 h) e apagado por `/cron/purge` chamado de hora em hora. Sem política de TTL: o deploy recusou (`billing disabled`), porque o TTL do Firestore exige o plano Blaze. Se o projeto passar para o Blaze, basta pôr `"ttl": true` no `expires_at` em `firestore.indexes.json`. Diferença: frases vencidas e ainda não apagadas não ficam mais escondidas pela regra de leitura (regras não filtram consultas).
- **Consentimento**: um documento por usuário e finalidade (`{uid}_{finalidade}`); conceder de novo reaproveita o documento (perde-se o histórico de concessões antigas).
- **E-mail confirmado obrigatório**: o Firebase deixa entrar sem confirmar; o site sai da sessão e mostra "confirme seu e-mail", e a API só cria perfil (e só dá papel de professor) para e-mail confirmado.
- **Sem `proxy.ts` nem `/auth/callback`**: o Firebase guarda a sessão no navegador, então a proteção das páginas fica no `useProfile`/`RoleGate` (redireciona para `/entrar?next=`). O link de redefinir senha usa a página do Firebase, ou `/redefinir-senha` se a URL de ação for personalizada.
- **Sem Analytics**: o trecho sugerido pelo console (`getAnalytics`) não foi usado, por privacidade (alunos menores, consentimento por finalidade).

## Escolha de papel no login (05/11/2026)
- **Professor fora da lista é recusado, não vira aluno.** A tela de entrar e de criar conta tem a escolha "Aluno / Professor" (o valor inicial vem do botão de onde a pessoa veio). Com "Professor", `POST /me/profile` recebe `intent: "professor"` e, se o e-mail não está na `teacherAllowlist`, responde 403 `not_teacher` **sem criar perfil**; o site sai da sessão e explica. Antes, a conta virava aluno em silêncio e ficava presa assim (o papel é gravado uma vez). Agora, quando a coordenação inclui o e-mail, basta entrar de novo.
- **A lista continua mandando**: e-mail autorizado sempre vira professor, mesmo escolhendo "Aluno". Conta que já existe como aluno e escolhe "Professor" também é recusada (conferido no navegador, pelo perfil).
- **A checagem só acontece depois de confirmar o e-mail**, nunca antes do cadastro: consultar a lista antes deixaria qualquer pessoa descobrir quais e-mails são de professor.

## Fase 6: IA gratuita com Gemini (05/11/2026, pedido do usuário)
- **Provedor `gemini`** (SDK oficial `google-genai` 2.34.0, fixado abaixo da 3.0 como o PyPI recomenda) ao lado de `mock` e `anthropic`. Mesmo contrato `complete_json`: o resto do fluxo (limpeza, blocos, validação Pydantic com uma nova tentativa) não mudou.
- **`generateContent` com `response_mime_type="application/json"` e `response_json_schema`**: a documentação nova chama essa API de "legacy" e recomenda a Interactions API, mas diz que ela continua com suporte total e não tem data de desligamento; é o caminho documentado no README do SDK. Palavras de esquema que o Gemini não suporta são ignoradas; quem garante o formato é o Pydantic.
- **Modelos**: `gemini-3.6-flash` (estável, com plano gratuito) no `LLM_MODEL` e `gemini-3.5-flash-lite` (estável, gratuito, com cota diária maior segundo relatos no fórum) no `GEMINI_FALLBACK_MODEL`. Os nomes vêm da página oficial de modelos e preços; os limites do plano gratuito não estão publicados (só no AI Studio).
- **Troca de modelo em vez de nova tentativa**: as cotas gratuitas são por modelo e por dia. Erro 429 passa para o modelo reserva e deixa o modelo esgotado de lado por 10 minutos (sem gastar chamadas nele); 5xx (sobrecarga) passa para o reserva só naquela chamada. Sem novas tentativas do SDK (`HttpRetryOptions(attempts=1)`): repetir cota diária só faz esperar. Timeout em milissegundos (`HttpOptions.timeout`), a partir de `LLM_TIMEOUT_SECONDS`.
- **Sem configuração de raciocínio (thinking)**: o padrão de cada modelo é usado, para não depender de um parâmetro que muda entre versões. `LLM_EFFORT` e `LLM_FALLBACKS` continuam só para o `anthropic`.
- **Privacidade**: no plano gratuito, a página de preços do Gemini diz que o conteúdo é usado para melhorar os produtos do Google ("Used to improve our products: Yes"); no plano pago, não. O que vai ao modelo é só a transcrição já limpa (sem e-mails, telefones e links), como antes. Registrado como pendência para a instituição aprovar.

## Fase 7: termos técnicos não são traduzidos para o espanhol (05/11/2026, pedido do usuário)
- **Problema**: o tradutor do Chrome traduzia a frase inteira, inclusive o jargão: "commit" virava "confirmación", "push" virava "empujar", "merge" virava "fusión". Programadores hispanofalantes dizem "commit".
- **Regra, tirada do próprio dicionário**: um termo é mantido quando o nome canônico também aparece nos nomes em espanhol do pacote (`explanations.es.names`): commit, push, branch, merge, pull request, deploy, bug, loop, array, useState etc. Palavras do português que têm nome próprio em espanhol continuam sendo traduzidas: variável → variable, função → función, parâmetro → parámetro, classe → clase, repositório → repositorio. Objeto, método, algoritmo e biblioteca são iguais nas duas línguas e ficam como estão.
- **Como**: antes de traduzir, cada termo mantido vira uma marca (`XQZ1`, `XQZ2`...), que o tradutor copia sem mexer; depois a marca volta a ser o termo exatamente como foi dito. Sem IA e sem rede: continua sendo o tradutor do próprio Chrome.
- **Plano B**: se o tradutor perder, repetir ou alterar uma marca, a frase é traduzida inteira e a tradução conhecida do termo (as outras entradas de `es.names`, como "confirmación") é trocada de volta pelo termo. Palavras do dia a dia em espanhol ("si", "mientras", "error", "unir", "publicar"...) nunca são trocadas nesse plano B, para não estragar a frase.
- **Vale para a legenda ao vivo e para "Traduzir resumo e quiz para espanhol"** (no resumo e no quiz os termos são achados pelo dicionário exato, sem correção aproximada).

## Fase 8: glossário da aula feito pela IA (05/11/2026, pedido do usuário)
- **Na mesma chamada do resumo e do quiz** (nenhuma chamada a mais na cota gratuita), a IA devolve `glossario`: até 10 termos técnicos ditos na aula que o dicionário não tem, com `nome_es` (jargão em inglês fica igual), categoria, explicação curta, exemplo e passo a passo em português e espanhol, explicação curta em inglês e até 4 prováveis erros do reconhecimento de voz (`variacoes`).
- **Só termos novos**: o navegador do professor manda os nomes canônicos do dicionário no corpo de `POST /end` e `/materials/regenerate` (`known_terms`, opcional); eles vão ao prompt e o resultado é filtrado de novo na API (sem acento, sem caixa, só letras e números). Os nomes são limpos antes do prompt (sem `<`, `>` nem quebras de linha), para não fecharem a marcação.
- **Exceção à regra "só o que foi dito"**: no glossário a IA pode usar conhecimento geral de programação para definir o termo (senão termos citados de passagem ficariam sem explicação), mas só para termos que apareceram na transcrição. O professor revisa tudo antes de liberar.
- **Termo com defeito é descartado, não gera nova tentativa**: um item fora do formato não pode custar outra chamada inteira (cota gratuita). O resto do material continua com a validação e a nova tentativa de antes.
- **Terceiro material (`materials/glossario`, conteúdo `{ "termos": [...] }`)**, rascunho até o professor aprovar, como resumo e quiz. As regras do Firestore passaram a aceitar o tipo `glossario` (com caso novo em `web/rules-tests/`). Material aprovado continua bloqueando "Tentar de novo".
- **O aluno não espera o glossário**: a revisão do aluno libera quando resumo e quiz estão aprovados; o glossário aparece quando também for aprovado. Sem termos novos, a tela do professor só avisa e não há nada a aprovar.
- **PDF**: os termos do glossário entram em "Termos-chave" com a explicação curta no idioma do PDF (o termo citado sem definição no dicionário passa a ter a da IA).
- **Resposta da API tolerante a edição**: o professor edita os materiais direto no Firestore (as regras, não o Pydantic, guardam essa escrita); se um material editado não bater com o esquema, ele fica de fora da resposta de `end` em vez de derrubar a rota (a tela lê os materiais do Firestore).
