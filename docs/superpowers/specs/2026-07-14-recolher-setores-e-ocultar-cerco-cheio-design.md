# Recolher setores no Quadrante + ocultar horários lotados no Cerco de Jericó

## Objetivo

Duas melhorias independentes de UX:
1. No Quadrante de Servos (admin), permitir minimizar/recolher cada setor pra facilitar a visualização de listas grandes.
2. Na página pública de inscrição do Cerco de Jericó, ocultar horários que já atingiram a lotação máxima, pra não confundir quem está se inscrevendo.

## Escopo

- Recolher/expandir setores por clique no cabeçalho do card, com estado lembrado no navegador (localStorage), por missão.
- Ocultar da grade pública do Cerco os horários com `qtd >= MAX_POR_HORARIO`.
- Se todos os horários estiverem lotados, mostrar mensagem no lugar da grade.
- O formulário admin de servo (`ServoForm.tsx`, usado em `/servos`) e o `cerco-dashboard` continuam mostrando todos os 24 horários sempre — a ocultação é só na página pública `/cerco/[slug]`.

Fora de escopo: botão "recolher todos / expandir todos" no Quadrante; lista de espera para horários lotados no Cerco.

## Design

### 1. Recolher setores (`src/app/(admin)/servos/page.tsx`)

- Extrair o card de cada setor (hoje um `<div className="mb-6 card overflow-hidden">` com header + tabela) para um novo componente client `SetorCard.tsx` em `src/app/(admin)/servos/`.
- `SetorCard` recebe como props o que hoje é renderizado inline: `setorNome`, `missaoId`, a lista de servos (`lista`) já processada, e o restante do markup que hoje vive no `.map` (cabeçalho com contagem, `AdicionarServoModal`, tabela de servos).
- Estado local `aberto: boolean`, inicializado `true` (aberto) por padrão.
- No mount (`useEffect`), lê `localStorage.getItem('quadrante:setores-colapsados:' + missaoId)` — um JSON com array de nomes de setores fechados — e se `setorNome` estiver nesse array, seta `aberto = false`.
- Clique no cabeçalho do card chama `toggle()`: inverte `aberto` e atualiza o array no localStorage (adiciona ou remove `setorNome`).
- Quando `aberto === false`, renderiza só o cabeçalho (nome do setor + contagem + um ícone indicando estado recolhido) — omite a tabela de servos e o botão `AdicionarServoModal` (ele volta a aparecer ao reabrir).
- `page.tsx` (server component) continua responsável por buscar e agrupar os dados; só troca o JSX do card por `<SetorCard key={setorNome} setorNome={setorNome} missaoId={missao.id} lista={lista} />`.
- Sem chamada de servidor nova — é só componente client + localStorage, igual ao padrão de outros toggles já existentes no projeto (nenhuma migration, nenhuma API).

### 2. Ocultar horários lotados no Cerco (`src/app/cerco/[slug]/page.tsx` + `CercoForm.tsx`)

- Em `page.tsx`, depois de montar `ocupados`, calcular:
  ```ts
  const horariosDisponiveis = HORARIOS_CERCO.filter((h) => (ocupados[h] || 0) < MAX_POR_HORARIO);
  ```
  (`MAX_POR_HORARIO` precisa ser movido para `src/lib/constants.ts` — hoje é uma constante local em `CercoForm.tsx` — pra ficar acessível também no server component.)
- Passar `horariosDisponiveis` para `CercoForm` no lugar do array fixo `HORARIOS_CERCO` que o form usa hoje internamente.
- `CercoForm` passa a receber uma nova prop `horarios: string[]` (em vez de importar `HORARIOS_CERCO` direto) e itera sobre ela pro grid de botões. Como só passam horários com vaga, o branch `cheio`/`disabled` do botão deixa de ser necessário (todo horário exibido sempre tem vaga) — mas mantém o contador `qtd/MAX` pra transparência de quantas vagas já foram preenchidas naquele horário.
- Se `horarios.length === 0`, `CercoForm` renderiza uma mensagem no lugar do grid: "Todos os horários já estão preenchidos, obrigado por querer servir! Fale com a coordenação do setor." — e desabilita o botão de submit (sem `horario` selecionado, ele já fica desabilitado hoje).
- `ServoForm.tsx` (admin) e `cerco-dashboard` **não mudam** — continuam importando `HORARIOS_CERCO` de `constants.ts` diretamente, sem filtro.

## Teste manual

**Recolher setores:**
1. Abrir `/servos` com uma missão que tenha vários setores.
2. Clicar no cabeçalho de um setor → lista de servos daquele setor some, fica só o cabeçalho.
3. Recarregar a página → o setor clicado continua recolhido.
4. Clicar de novo → expande, e recarregar mantém expandido.
5. Trocar de missão (se aplicável) → estado de colapso é independente por missão.

**Ocultar horários lotados:**
1. Preencher um horário do Cerco até `MAX_POR_HORARIO` (15) inscrições ATIVO.
2. Acessar `/cerco/<slug>` como visitante → esse horário não aparece mais na grade.
3. Verificar que os demais horários com vaga continuam aparecendo normalmente com a contagem.
4. Acessar `/servos/<id>` (editar servo) no admin → o select de horário ainda lista o horário lotado, permitindo realocar manualmente.
5. (Opcional, cenário extremo) Lotar todos os 24 horários → a página pública mostra a mensagem de "todos preenchidos" no lugar da grade.
