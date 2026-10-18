# Atualização v1.2: Evangelização (equipes e distribuição das casas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formar as equipes de Evangelização (3 pessoas, com carro) e sortear 3 a 4 casas de neocampistas por equipe, sem nunca mandar uma equipe à cidade de um dos seus membros.

**Architecture:** Lógica pura e testada (`cidades.ts`, `equipesEvangelizacao.ts`, `sorteioCasas.ts`) recebe dados simples e um `rng` injetável; uma camada de dados (`evangelizacaoDados.ts`) carrega do Prisma e grava; ações de servidor finas (`actionsEvangelizacao.ts`) chamam `requireUser` + checagem de missão + trava; telas novas em `(admin)/evangelizacao`. Cidade é sempre comparada pelo id canônico (tabela de apelidos), nunca pelo texto.

**Tech Stack:** Next.js (versão com mudanças incompatíveis, ver Global Constraints), Prisma 6 + SQLite, TypeScript, `node:test` via `tsx` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-17-evangelizacao-distribuicao-design.md`

## Global Constraints

- Tudo em `/home/true/quadrante/app`. **Não é repositório git**: não há commits. O ponto de segurança é o backup do banco antes de migrar: `prisma/quadrante.db.bak-antes-evangelizacao-v1-2`.
- `AGENTS.md`: este Next.js não é o que você conhece. Antes de escrever qualquer página ou componente, leia o guia relevante em `node_modules/next/dist/docs/01-app` e `02-pages`.
- Toda `page.tsx` e `route.ts` em `src/app/(admin)` chama `await requireUser()` (ou `requireRole`) na primeira linha; `src/lib/protecao-paginas.test.ts` varre isso e quebra o `npm test` se faltar.
- Arquivo `"use server"` só exporta funções assíncronas. Helpers puros ficam fora dele.
- Todo `id` vindo do navegador é conferido contra a missão do usuário com `exigirMissao`/`podeAcessarMissao` de `src/lib/autorizacao.ts`; a missão do registro vem do banco, não do formulário.
- Equipe de **3 pessoas**; **3 a 4 casas** por equipe; ≥ 1 carro por equipe; impedimento por cidade canônica de **qualquer membro**.
- Prioridade das regras: (1) impedimento nunca quebrado pelo algoritmo, (2) equilíbrio 3–4 casas, (3) preferência por cidade vizinha, (4) agrupar por cidade e bairro.
- Servo sem cidade reconhecida ⇒ a equipe dele fica fora do sorteio e em destaque. Ficha sem cidade reconhecida ⇒ vai para pendências.
- Fichas elegíveis: `Neocampista.situacao = "OK"`. Servos elegíveis: `Servo.setor = "EVANGELIZAÇÃO"` e `status = "ATIVO"`.
- Fechada a distribuição (`Missao.evangelizacaoFechada`): bloqueados sorteio, mover casa, trocar membro, criar/apagar equipe. Imprimir só com a distribuição fechada. Só SUPER reabre.
- Textos da interface em português; seguir as classes/tokens de `globals.css` já usados em `tribos/page.tsx` (`card`, `page-title`, `var(--ink)`).

## Review Focus

- Grafias diferentes da mesma cidade (`PALHOÇA`, `Palhoça - SC`, `Sto Amaro Imp. - SC`) não podem passar como cidades distintas pelo impedimento.
- Ficha sem cidade (89 na base histórica) e cidade não reconhecida: nunca alocadas em silêncio.
- Menos casas que equipes, e zero equipes elegíveis: sem divisão por zero, sem equipe forçada.
- Novo sorteio com casas fixadas: as fixadas não mudam; repetir o sorteio com `rng` diferente pode dar resultado diferente.
- Distribuição fechada: toda ação de escrita recusa, inclusive mover casa e trocar membro.

---

### Task 1: Cidade canônica (módulo puro)

**Files:**
- Create: `src/lib/cidades.ts`
- Test: `src/lib/cidades.test.ts`

**Interfaces:**
- Produces:
  - `normalizarCidade(texto: string): string`
  - `type MapaApelidos = Map<string, number>` (apelido normalizado → `cidadeId`)
  - `resolverCidade(texto: string | null | undefined, mapa: MapaApelidos): number | null`
  - `type Vizinhanca = Set<string>`; `chaveVizinha(a: number, b: number): string` (`"menor-maior"`); `saoVizinhas(v: Vizinhanca, a: number | null, b: number | null): boolean`

- [ ] **Step 1: Write the failing test** em `cidades.test.ts`:
  - `normalizarCidade("PALHOÇA")`, `("Palhoça - SC")` e `("palhoca")` valem `"palhoca"`.
  - `normalizarCidade("Sto Amaro Imp. - SC")` vale `"sto amaro imp"`; `("  Florianopolis ")` vale `"florianopolis"`.
  - `resolverCidade("Palhoça - SC", new Map([["palhoca", 1]]))` vale `1`; texto desconhecido, `""`, `null` e `undefined` valem `null`.
  - `chaveVizinha(5, 2)` vale `"2-5"`; `saoVizinhas` é simétrica e devolve `false` se qualquer lado for `null`.
- [ ] **Step 2: Run** `npx tsx --test src/lib/cidades.test.ts`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** em `cidades.ts`. `normalizarCidade`: minúsculas, `normalize("NFD")` sem diacríticos, remove sufixo `- sc`/`/sc`, remove pontuação, colapsa espaços, trim.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.

### Task 2: Esquema e migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261017120000_evangelizacao_v1_2/migration.sql`

**Interfaces:**
- Produces (Prisma): `Cidade{id,nome @unique}`, `CidadeApelido{id,apelido @unique,cidadeId}`, `CidadeVizinha{cidadeId,vizinhaId, @@id([cidadeId,vizinhaId])}` (guardar os dois sentidos), `EquipeEvangelizacao{id,missaoId,nome}`, `Servo.temCarro Boolean @default(false)`, `Servo.equipeEvangelizacaoId Int?`, `Neocampista.equipeEvangelizacaoId Int?`, `Neocampista.casaFixada Boolean @default(false)`, `Missao.evangelizacaoFechada Boolean @default(false)`, com `@@index` nas FKs novas.

- [ ] **Step 1: Backup**: `cp prisma/quadrante.db prisma/quadrante.db.bak-antes-evangelizacao-v1-2`.
- [ ] **Step 2:** Editar `schema.prisma` com os modelos e campos acima (relações nomeadas; `onDelete: SetNull` nas FKs de equipe para apagar uma equipe soltar membros e casas).
- [ ] **Step 3:** `npx prisma migrate dev --name evangelizacao_v1_2 --create-only`, renomear a pasta gerada para o nome acima se necessário, conferir que o SQL só adiciona (nenhum `DROP`).
- [ ] **Step 4:** `npx prisma migrate deploy && npx prisma generate`. Expected: migração aplicada; `npx tsc --noEmit` sem erros.

### Task 3: Carga inicial de cidades, apelidos e vizinhança

**Files:**
- Create: `scripts/seed-cidades.ts`

**Interfaces:**
- Consumes: `normalizarCidade` (Task 1), modelos da Task 2.

- [ ] **Step 1:** Escrever o script, idempotente (`upsert`), que:
  1. cria as cidades canônicas: Florianópolis, São José, Palhoça, Biguaçu, Santo Amaro da Imperatriz, Águas Mornas, Anitápolis, Rancho Queimado, Angelina, Leoberto Leal, Armazém, Laguna;
  2. grava apelidos: o `normalizarCidade` do nome canônico mais `santo amaro`, `sto amaro`, `sto amaro imp`, `sto amaro imperatriz`, `santo amaro da imp`, `floripa`;
  3. grava a vizinhança (nos dois sentidos). **Rascunho a ser conferido pelo usuário**, escrito em um array no topo do arquivo com o comentário "rascunho — conferir": Florianópolis–São José, Florianópolis–Biguaçu, São José–Biguaçu, São José–Palhoça, São José–Santo Amaro da Imperatriz, Palhoça–Santo Amaro da Imperatriz, Palhoça–Águas Mornas, Santo Amaro da Imperatriz–Águas Mornas, Santo Amaro da Imperatriz–Anitápolis, Águas Mornas–Rancho Queimado, Águas Mornas–Anitápolis, Anitápolis–Rancho Queimado, Anitápolis–Angelina, Anitápolis–Leoberto Leal, Angelina–Rancho Queimado, Armazém–Anitápolis, Armazém–Laguna.
- [ ] **Step 2:** Rodar `npx tsx scripts/seed-cidades.ts` e imprimir a contagem de cidades, apelidos e pares. Em seguida imprimir quantas cidades distintas de `Pessoa` e `Neocampista` **não** resolvem (a Task 8 mostra essa lista na tela). Expected: as grafias de Palhoça, Santo Amaro, Anitápolis e Florianópolis resolvem.

### Task 4: Formar equipes (módulo puro)

**Files:**
- Create: `src/lib/equipesEvangelizacao.ts`
- Test: `src/lib/equipesEvangelizacao.test.ts`

**Interfaces:**
- Consumes: `Vizinhanca`, `saoVizinhas` (Task 1).
- Produces:
  - `type ServoEv = { id: number; cidadeId: number | null; temCarro: boolean }`
  - `type TipoAvisoEquipe = "SEM_CARRO" | "TAMANHO" | "CIDADE_DESCONHECIDA" | "NAO_VIZINHAS"`
  - `validarEquipe(membros: ServoEv[], viz: Vizinhanca): TipoAvisoEquipe[]` (`TAMANHO` quando ≠ 3; `NAO_VIZINHAS` quando há dois membros de cidades diferentes que não são vizinhas)
  - `formarEquipes(servos: ServoEv[], viz: Vizinhanca, rng?: () => number): { equipes: number[][] }` (ids de servo por equipe)

- [ ] **Step 1: Write the failing test:**
  - 9 servos (3 de cada cidade A, B, C, três cidades sem relação) ⇒ 3 equipes de 3, cada equipe com uma só cidade.
  - 7 servos ⇒ 2 equipes (tamanhos 3 e 4); 8 servos ⇒ 2 equipes (4 e 4); nenhuma equipe de 1 ou 2.
  - Servos de A e B vizinhas entram juntos antes de se misturar com C não vizinha.
  - 6 servos com 2 carros ⇒ cada equipe tem 1 carro; com 1 carro ⇒ uma equipe sem carro e `validarEquipe` devolve `SEM_CARRO` para ela.
  - Servo com `cidadeId: null` nunca divide equipe com servo de cidade conhecida, e `validarEquipe` devolve `CIDADE_DESCONHECIDA`.
  - Mesmo `rng` fixo ⇒ mesmo resultado.
- [ ] **Step 2: Run** `npx tsx --test src/lib/equipesEvangelizacao.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Abordagem: agrupar por cidade; ordenar as cidades percorrendo a vizinhança (começa pela maior, segue pelas vizinhas) para que servos de cidades próximas fiquem seguidos; servos sem cidade vão por último; cortar em equipes de 3; a sobra de 1 ou 2 entra nas últimas equipes (viram 4); depois, para cada equipe sem carro, trocar um servo sem carro dela por um com carro da equipe vizinha na ordem que tenha carro sobrando. `rng` só desempata dentro de uma cidade.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.

### Task 5: Sorteio das casas (módulo puro)

**Files:**
- Create: `src/lib/sorteioCasas.ts`
- Test: `src/lib/sorteioCasas.test.ts`

**Interfaces:**
- Consumes: `Vizinhanca`, `saoVizinhas` (Task 1).
- Produces:
  - `type EquipeSorteio = { id: number; cidades: (number | null)[] }` (uma cidade por membro)
  - `type CasaSorteio = { id: number; cidadeId: number | null; bairro: string | null; fixadaEm: number | null }` (`fixadaEm` = id da equipe quando fixada)
  - `type StatusCasa = "OK" | "IMPEDIDA" | "CIDADE_DESCONHECIDA"`
  - `validarCasa(equipe: EquipeSorteio, casaCidadeId: number | null): StatusCasa`
  - `type ResultadoSorteio = { alocacao: Map<number, number>; pendencias: { casaId: number; motivo: "SEM_CIDADE" | "SEM_EQUIPE_PERMITIDA" }[]; equipesAcimaDoLimite: number[] }` (`alocacao`: casaId → equipeId, inclui as fixadas)
  - `sortearCasas(equipes: EquipeSorteio[], casas: CasaSorteio[], viz: Vizinhanca, rng?: () => number): ResultadoSorteio`

- [ ] **Step 1: Write the failing test** (cidades por id: Palhoça=1, São José=2, Santo Amaro=3, Biguaçu=4; vizinhança 1–2, 1–3, 2–3, 2–4):
  - Casa de Palhoça nunca vai para equipe com membro de Palhoça, mesmo havendo capacidade sobrando.
  - Entre equipe de Palhoça-vizinha (São José) e equipe de Biguaçu para uma casa de Palhoça, escolhe a de São José (preferência por vizinha) quando as duas têm vaga.
  - 8 casas e 2 equipes permitidas ⇒ 4 e 4; 7 casas ⇒ 4 e 3; 3 casas e 2 equipes ⇒ nenhuma equipe com mais de 2.
  - Equipe com membro de `cidade null` não recebe nenhuma casa; `validarCasa` devolve `CIDADE_DESCONHECIDA`.
  - Casa com `cidadeId: null` vai para `pendencias` com `SEM_CIDADE`; casa cuja cidade é impedida em todas as equipes vai para `SEM_EQUIPE_PERMITIDA`.
  - Casa com `fixadaEm: 7` fica na equipe 7 no resultado, mesmo que viole o impedimento.
  - Zero equipes elegíveis ⇒ todas as casas em pendências, sem erro.
  - `rng` diferentes podem dar `alocacao` diferente quando há empate; mesmo `rng` dá o mesmo resultado.
  - Mais casas permitidas do que `4 × equipes` ⇒ `equipesAcimaDoLimite` lista as equipes com mais de 4.
- [ ] **Step 2: Run** `npx tsx --test src/lib/sorteioCasas.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Guloso: equipes elegíveis = sem membro de cidade `null`; teto = `ceil(N / E)` em que N conta as casas com cidade e E as equipes elegíveis; embaralhar casas com o `rng` (agrupadas por cidade e bairro para casas vizinhas caírem juntas); para cada casa escolher, entre as equipes permitidas com vaga, por ordem: tem membro de cidade vizinha, já tem casa da mesma cidade/bairro, menos carregada, `rng`; se nenhuma permitida tem vaga, aceitar a permitida menos carregada (isso gera `equipesAcimaDoLimite` quando passar de 4). Casas fixadas entram primeiro e contam na carga.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.

### Task 6: Camada de dados e trava (Prisma)

**Files:**
- Create: `src/lib/evangelizacaoDados.ts`
- Test: `src/lib/evangelizacaoDados.test.ts` (mesmo molde de `autorizacao.test.ts`: banco temporário via `prisma migrate deploy`, `DATABASE_URL` definido antes do import dinâmico)

**Interfaces:**
- Consumes: Tasks 1, 4, 5.
- Produces:
  - `carregarMapaCidades(): Promise<{ mapa: MapaApelidos; viz: Vizinhanca }>`
  - `exigirDistribuicaoAberta(missaoId: number): Promise<void>` (lança `Error("Distribuição fechada.")`)
  - `aplicarSugestaoEquipes(missaoId: number): Promise<{ equipes: number }>` (apaga as equipes atuais da missão, cria as sugeridas, preenche `Servo.equipeEvangelizacaoId`)
  - `aplicarSorteio(missaoId: number, rng?: () => number): Promise<ResultadoSorteio>` (grava `Neocampista.equipeEvangelizacaoId`; zera as não fixadas antes; fichas `situacao = "OK"`)
  - `carregarPainel(missaoId: number)`: equipes com membros (nome, celular, cidade canônica, `temCarro`, avisos de `validarEquipe`), casas por equipe com `validarCasa`, pendências (fichas sem cidade reconhecida, sem equipe), servos de Evangelização sem equipe, cidades não reconhecidas com contagem.

- [ ] **Step 1: Write the failing test** (banco temporário, missão com 6 servos de Evangelização em Palhoça e São José e 8 fichas):
  - `aplicarSugestaoEquipes` cria 2 equipes e todos os servos ficam com equipe.
  - `aplicarSorteio` nunca põe ficha de Palhoça em equipe com servo de Palhoça, mesmo com a ficha gravada como `"PALHOÇA - SC"` e o servo como `"Palhoça"`.
  - Ficha com cidade `"Xyz"` aparece em `pendencias` e fica sem equipe; ficha com `situacao` diferente de `"OK"` é ignorada.
  - Casa com `casaFixada = true` mantém a equipe depois de um novo `aplicarSorteio`.
  - Com `evangelizacaoFechada = true`, `exigirDistribuicaoAberta` lança e `aplicarSorteio`/`aplicarSugestaoEquipes` também.
- [ ] **Step 2: Run** `npx tsx --test src/lib/evangelizacaoDados.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** as funções acima; as de escrita chamam `exigirDistribuicaoAberta` primeiro e gravam numa `db.$transaction`.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.

### Task 7: Ações de servidor

**Files:**
- Create: `src/lib/actionsEvangelizacao.ts` (`"use server"`)
- Test: `src/lib/protecao-paginas.test.ts` já cobre páginas; para as ações, estender `src/lib/evangelizacaoDados.test.ts` só nos pontos que dependem de dados (a checagem de sessão é a mesma de `actions.ts`).

**Interfaces:**
- Consumes: Task 6, `requireUser`, `requireRole`, `exigirMissao`, `exigirRegistros` (para `servo` e `ficha`).
- Produces (todas `async`, devolvem `{ ok: true } | { error: string }`, chamam `revalidatePath("/evangelizacao")`):
  - `marcarTemCarro(servoId: number, temCarro: boolean)`
  - `sugerirEquipes(missaoId: number)`
  - `criarEquipe(missaoId: number)`, `apagarEquipe(equipeId: number)`
  - `moverServoEquipe(servoId: number, equipeId: number | null)`
  - `rodarSorteio(missaoId: number)`
  - `moverCasa(fichaId: number, equipeId: number | null)` (grava `casaFixada = true`)
  - `limparFixacoes(missaoId: number)`
  - `fecharDistribuicao(missaoId: number)` (ADMIN da missão ou SUPER), `reabrirDistribuicao(missaoId: number)` (`requireRole("SUPER")`)
  - `associarApelidoCidade(texto: string, cidadeId: number)` (grava `normalizarCidade(texto)`; erro se já existir apontando para outra cidade) e `salvarVizinhanca(cidadeId: number, vizinhasIds: number[])` (grava nos dois sentidos)

- [ ] **Step 1:** Implementar cada ação: autenticar, descobrir a missão do registro no banco, `exigirMissao`, `exigirDistribuicaoAberta` (menos `fechar`, `reabrir`, cidades e vizinhança, que valem em qualquer estado), validar ids como inteiros positivos e que a equipe pertence à mesma missão do servo ou da ficha movida.
- [ ] **Step 2:** Estender o teste de dados: `moverCasa` para equipe de outra missão é recusada; qualquer ação de escrita após `fecharDistribuicao` é recusada.
- [ ] **Step 3: Run** `npm test`. Expected: tudo PASS.

### Task 8: Telas (equipes, sorteio, cidades e impressão)

**Files:**
- Create: `src/app/(admin)/evangelizacao/page.tsx`, `src/app/(admin)/evangelizacao/cidades/page.tsx`, `src/app/(admin)/evangelizacao/imprimir/page.tsx` e os componentes de cliente que precisarem de interação ao lado de cada página (mesmo padrão de `tribos/AlocarFichaForm.tsx`).
- Modify: `src/app/(admin)/layout.tsx` (item `["/evangelizacao", "Evangelização", false]` em `NAV`, depois de "Tribos").

**Interfaces:**
- Consumes: `carregarPainel` (Task 6) e as ações da Task 7.

- [ ] **Step 1:** Ler a documentação do Next em `node_modules/next/dist/docs/01-app` sobre páginas e formulários antes de escrever as páginas.
- [ ] **Step 2: `/evangelizacao`:** seções (a) servos sem equipe com marcador "tem carro"; (b) equipes: membros, cidade, carro, selos de aviso (sem carro, tamanho, cidades não vizinhas, cidade desconhecida), trocar membro de equipe, criar/apagar equipe, botão "Sugerir equipes"; (c) sorteio: botão "Sortear casas", casas por equipe com selo de violação em destaque, mover casa, "Limpar fixações", contagem de casas por cidade; (d) pendências (ficha sem cidade reconhecida, sem equipe permitida, equipe acima de 4); (e) "Fechar distribuição" (e "Reabrir" só para SUPER). Com a distribuição fechada, controles de escrita desabilitados e aviso no topo.
- [ ] **Step 3: `/evangelizacao/cidades`:** lista de grafias não reconhecidas (com quantas fichas e servos usam) com seleção da cidade canônica; editor de vizinhança por cidade com o aviso "vizinhança não conferida" até o usuário marcar como conferida (guardar em `Missao`? **Não**: usar um aviso fixo na tela, a conferência é do usuário).
- [ ] **Step 4: `/evangelizacao/imprimir`:** se `evangelizacaoFechada` for falso, mostra "Feche a distribuição para imprimir" e nenhum dado de neocampista. Se fechada, uma seção por equipe com `page-break-after: always`: nome da equipe, 3 membros com celular, quem tem carro, e 3 a 4 casas (nome, endereço, bairro, cidade, celular); mais uma folha-resumo com a contagem de casas por cidade.
- [ ] **Step 5:** `npm test`, `npx tsc --noEmit` e `npm run lint`. Expected: sem erros.

### Task 9: Verificação ponta a ponta e v1.2

**Files:**
- Modify: `README.md` (módulo "Evangelização" na lista de módulos e uma linha "v1.2")

- [ ] **Step 1:** `npm run build`. Expected: build conclui.
- [ ] **Step 2:** Subir `npm run dev`, abrir `/evangelizacao` na missão ativa e conferir com dados reais: equipes sugeridas, sorteio, selo de violação ao mover uma casa de Palhoça para uma equipe com servo de Palhoça, fechar, imprimir, reabrir como SUPER.
- [ ] **Step 3:** Atualizar o `README.md`.
- [ ] **Step 4:** **Não publicar em produção sem o usuário pedir.** Quando pedir: backup do banco, `npx prisma migrate deploy`, `npm run build`, `pm2 restart quadrante`, `pm2 save` (hospedagem local descrita no README).
