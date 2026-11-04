# Testes manuais

Roteiros para a equipe rodar com pessoas e aparelhos reais. Anote os resultados em uma planilha com data, aparelho, navegador e rede.

## Preparação
- Professor: Chrome ou Edge no **computador**, em `localhost` ou HTTPS. Microfone do notebook ou com fio (evite Bluetooth).
- Estudantes: celulares na mesma rede (desenvolvimento: `DEV_ORIGINS=<IP do computador>` no ambiente do `web/` e `WEB_ORIGIN` com `http://<IP>:3000` no `api/.env`), ou a URL publicada.
- Usuários de teste: `npm run seed:dev` (senha em `DEV_USERS_PASSWORD`).

## Teste A: reconhecimento dos 20 termos (com e sem dicionário)
Objetivo: medir quanto o dicionário corrige os erros típicos do reconhecimento em pt-BR.

1. Escolha 20 termos do pacote (sugestão: commit, push, pull request, branch, merge, git, GitHub, repositório, JSON, API, array, string, boolean, loop, while, if, else, useState, useEffect, deploy).
2. Para cada termo, a pessoa que fala lê **duas frases naturais** que o usem (ex.: "agora eu faço o commit da mudança").
3. Rode duas vezes:
   - **Sem dicionário**: anote o texto que aparece no "Ouvindo agora (só você vê)" (texto bruto do reconhecimento).
   - **Com dicionário**: anote a frase enviada (com o termo destacado).
4. Para cada termo, marque: reconhecido certo sem dicionário? Corrigido com dicionário? Falso positivo (destacou algo que não era termo)?
5. Para cada erro não corrigido, registre o texto que apareceu e use "Corrigir reconhecimento de termo" na tela ao vivo. Leve a lista para a curadoria do pacote (`web/src/content/packs/programacao-geral.json`).
6. Repita com duas vozes diferentes (timbre e sotaque) e, se possível, com um falante não nativo.

Resultado esperado: taxa de acerto com dicionário ≥ 90%, sem falsos positivos frequentes.

## Teste B: latência de ponta a ponta
Objetivo: confirmar que a frase chega ao celular em até 2 s depois de o professor terminar de falar.

1. Um único aparelho como referência de relógio (armadilha 34): **grave a tela** do computador do professor com o celular do estudante visível na mesma gravação, ou abra professor e estudante no mesmo computador (duas abas, `?debug=1` no estudante).
2. Fale 20 frases curtas. Para cada uma, meça na gravação o tempo entre o fim da fala e a frase aparecer no celular.
3. O painel `?debug=1` mostra `now - sentAt` (só é exato com os dois lados no mesmo aparelho).
4. Repita com o celular em 4G e no Wi-Fi da escola.

Resultado esperado: p95 ≤ 2 s. Referência automatizada: `npm run load:test` (40 clientes) mediu p95 de ~0,3 s na rede local desta máquina.

## A/B de 1 hora (aula real)
Objetivo: comparar a experiência com e sem o EchoDev numa aula de verdade.

1. Duas turmas (ou duas metades da mesma turma) com a mesma aula de ~1 h.
   - **A**: aula normal.
   - **B**: aula com o EchoDev (legenda, termos, resumo e quiz aprovados).
2. Ao final, as duas turmas fazem o **mesmo** quiz de 5 questões (o quiz aprovado pelo professor, aplicado em papel para a turma A).
3. Questionário curto (anônimo): "Consegui acompanhar a explicação" (1–5), "Entendi os termos técnicos" (1–5), "Usaria de novo" (sim/não), e um campo aberto.
4. Com a turma B: relatório do professor (`/professor/aulas/<id>/relatorio`) com termos mais consultados e trechos rápidos.
5. Durante a aula, observe: o reconhecimento parou? (indicador "Reconectando…"), a legenda atrasou? celulares apagaram a tela?
6. Público em destaque: inclua, se possível, estudantes estrangeiros e com deficiência auditiva, **com consentimento e conforme as regras da instituição**.

## Checklist rápido de regressão (antes da demo)
- [ ] `npm run check` verde.
- [ ] `npm run check:rls` com 0 falhas.
- [ ] Demo offline: `/demo/professor` + `/demo/estudante` em duas abas, "Usar aula de demonstração".
- [ ] Aula real: criar aula → QR → estudante entra pelo celular → consentimentos → legenda → tocar termo → "Ajudou".
- [ ] Encerrar → revisar → aprovar → estudante vê `/aula/<código>/revisao`.
- [ ] Recarregar o celular no meio da aula recupera as frases.
- [ ] Profundidade e idioma da explicação ficam salvos depois de recarregar.
- [ ] Falar um palavrão: ele aparece como `***` no professor e no estudante (e nunca vai para o banco).
- [ ] Falar um termo com 1 letra trocada (ex.: "comitti", "merje"): sai corrigido. "Quadro branco" continua "branco".
- [ ] "Baixar resumo em PDF" no estudante (sem gabarito) e "Baixar PDF (resumo + quiz com gabarito)" no professor.
- [ ] Ao encerrar a aula, o celular do estudante mostra "A aula terminou" e o botão "Ver resumo e quiz"; a tela fica "Aguardando a aprovação" e atualiza sozinha quando o professor aprova.
- [ ] iOS (Safari): legenda, toque no termo e quiz (o professor não precisa de iOS).
