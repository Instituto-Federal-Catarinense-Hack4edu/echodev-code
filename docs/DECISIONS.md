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
