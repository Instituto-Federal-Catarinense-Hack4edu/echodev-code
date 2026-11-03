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
