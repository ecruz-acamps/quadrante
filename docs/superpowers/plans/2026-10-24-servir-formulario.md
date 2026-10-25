# Candidatos a servir (formulário) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o Google Forms de candidatos a servir por uma página pública por missão com perguntas editáveis, mais uma tela de triagem no Quadrante.

**Architecture:** Lógica em módulos novos de `src/lib` que recebem o `db` por parâmetro (testáveis com `criarBancoTemporario`); server actions finas em `actionsServir.ts`; páginas novas em `src/app/servir/[slug]` (pública) e `src/app/(admin)/candidatos` e `.../configuracoes/perguntas-servir` (admin). Tudo aditivo: 2 tabelas novas e 2 colunas em `Missao`.

**Tech Stack:** Next.js 16.4 (App Router, server actions), Prisma 6 + SQLite, React 19, `node:test` via `tsx`, `exceljs`.

**Spec:** `docs/superpowers/specs/2026-10-24-servir-formulario-design.md`

## Global Constraints

- **Antes de escrever qualquer página, action ou rota, ler `node_modules/next/dist/docs/01-app/02-guides/forms.md` e `01-app/01-getting-started/07-mutating-data.md`** (`AGENTS.md`: este Next não é o que se conhece; `params` e `searchParams` são `Promise`).
- Nada vai para produção sem o dono dizer "liberar" (Task 13). Testes e verificação manual rodam em **cópia do banco na porta 3011**, nunca em `prisma/quadrante.db`.
- Migração Prisma **aditiva**; nenhum dado existente é alterado.
- Não commitar: o dono não pediu. Os passos de commit do modelo padrão foram omitidos de propósito.
- CPF guardado só com dígitos. Texto da interface em português do Brasil.
- Páginas e rotas em `(admin)` chamam `requireUser()` ou `requireRole("SUPER")` **dentro do próprio arquivo** (`protecao-paginas.test.ts` exige).
- Server actions ficam em arquivo `"use server"`; funções que não podem ser chamadas pelo navegador **não** são exportadas desses arquivos.
- Testes em `src/lib/*.test.ts` (o `npm test` só varre essa pasta). Teste com banco segue `src/lib/cercoReserva.test.ts`: `criarBancoTemporario()` e `process.env.DATABASE_URL` antes de `import("./db")`.
- Limites: texto curto 200 caracteres, texto longo 2000, título de pergunta 200, opção 120, nome 120.

## Review Focus

- CPF digitado com pontos/espaços ou com todos os dígitos iguais (`111.111.111-11`): aceitar a pontuação, rejeitar o repetido. (Task 1)
- Pessoa reenvia o formulário depois de aprovada: dados atualizam, `status` e `servoId` ficam. (Task 6)
- Resposta a pergunta desativada, desconhecida, ou lista de valores numa `ESCOLHA_UMA`: ignorada ou rejeitada, nunca gravada. (Task 2)
- Casado sem nome/celular do cônjuge, ou não casado mandando dados de cônjuge: rejeitar no primeiro, descartar no segundo. (Task 2)
- Aprovar duas vezes o mesmo candidato, ou com `disponivel = false`: segunda vez e indisponível recusados, nenhum `Servo` duplicado. (Task 6)
- Dois candidatos com o mesmo celular de cônjuge: sem ligação por celular. (Task 3)

---

### Task 1: Helpers de CPF

**Files:**
- Create: `src/lib/cpf.ts`
- Test: `src/lib/cpf.test.ts`

**Interfaces:**
- Produces:
  - `soDigitos(valor: string): string`
  - `cpfValido(valor: string): boolean` — 11 dígitos, não todos iguais, dois dígitos verificadores corretos
  - `cpfReal(valor: string | null | undefined): boolean` — 11 dígitos e não todos iguais (não confere dígitos verificadores; serve para dados antigos)

- [ ] **Step 1: Write the failing test** `cpf.test.ts`: `cpfValido("529.982.247-25") === true`; `cpfValido(" 52998224725 ") === true`; `cpfValido("529.982.247-24") === false`; `cpfValido("111.111.111-11") === false`; `cpfValido("123") === false`; `cpfReal("000.000.000-00") === false`; `cpfReal(null) === false`; `cpfReal("529.982.247-24") === true`; `soDigitos("(48) 99999-0000") === "48999990000"`.
- [ ] **Step 2: Run** `npx tsx --test src/lib/cpf.test.ts` — FAIL (módulo não existe).
- [ ] **Step 3: Implement** as três funções em `src/lib/cpf.ts` (algoritmo padrão do CPF, módulo 11).
- [ ] **Step 4: Run** o mesmo comando — PASS.

### Task 2: Validação das respostas e dos campos fixos

**Files:**
- Create: `src/lib/servirRespostas.ts`
- Test: `src/lib/servirRespostas.test.ts`

**Interfaces:**
- Consumes: `cpfValido`, `soDigitos` (Task 1); `normalizarNome` de `src/lib/nomes.ts`.
- Produces:
  - `TIPOS_PERGUNTA = ["TEXTO_CURTO","TEXTO_LONGO","SIM_NAO","ESCOLHA_UMA","ESCOLHA_VARIAS","NUMERO","DATA"] as const` e `type TipoPergunta`
  - `OUTRA = "__outra__"`
  - `type PerguntaForm = { id: number; titulo: string; tipo: TipoPergunta; obrigatoria: boolean; opcoes: string[]; permiteOutra: boolean }`
  - `type RespostaSalva = { perguntaId: number; titulo: string; tipo: TipoPergunta; valor: string | string[] }` (serializada com `perguntaId` como primeira chave)
  - `type EntradaResposta = { valores: string[]; outra?: string }`
  - `validarRespostas(perguntas: PerguntaForm[], entrada: Record<number, EntradaResposta | undefined>): { ok: true; respostas: RespostaSalva[] } | { ok: false; erros: Record<number, string> }`
  - `type EntradaFixos = { nome: string; cpf: string; celular: string; casado: string; conjugeNome: string; conjugeCelular: string; disponivel: string }`
  - `type DadosFixos = { nome: string; cpf: string; celular: string; casado: boolean; conjugeNome: string | null; conjugeCelular: string | null; disponivel: boolean }`
  - `validarFixos(e: EntradaFixos): { ok: true; dados: DadosFixos } | { ok: false; erros: Partial<Record<keyof EntradaFixos, string>> }`

- [ ] **Step 1: Write the failing tests.** `validarRespostas`: obrigatória vazia → `erros[id]`; opcional vazia → ausente de `respostas`; `SIM_NAO` só aceita `"Sim"`/`"Não"`; `NUMERO` aceita `"2015"`, rejeita `"abc"`; `DATA` aceita `"2000-02-29"`, rejeita `"2001-02-29"`; `ESCOLHA_UMA` com 2 valores → erro; valor fora de `opcoes` → erro; `OUTRA` sem `permiteOutra` → erro, com `permiteOutra` e `outra: " Paróquia X "` → `valor === "Paróquia X"`; `ESCOLHA_VARIAS` aceita lista sem repetidos; pergunta ausente em `perguntas` (desativada) é ignorada mesmo se vier na entrada; `TEXTO_CURTO` com 201 caracteres → erro. `validarFixos`: CPF inválido → `erros.cpf`; celular com 9 dígitos → `erros.celular`, com 11 passa; `casado: "Sim"` sem `conjugeNome` ou sem `conjugeCelular` válido → erro em cada campo; `casado: "Não"` com dados de cônjuge → `conjugeNome` e `conjugeCelular` viram `null`; `disponivel` só `"Sim"`/`"Não"`; nome vira `normalizarNome(...)`; CPF e celulares saem só com dígitos.
- [ ] **Step 2: Run** `npx tsx --test src/lib/servirRespostas.test.ts` — FAIL.
- [ ] **Step 3: Implement** as duas funções e os tipos. Celular válido = 10 a 13 dígitos. Data válida = calendário real em `YYYY-MM-DD`. Número = `/^-?\d+([.,]\d+)?$/`, até 12 caracteres.
- [ ] **Step 4: Run** — PASS.

### Task 3: Ligação de cônjuges

**Files:**
- Create: `src/lib/servirConjuge.ts`
- Test: `src/lib/servirConjuge.test.ts`

**Interfaces:**
- Consumes: `soDigitos` (Task 1).
- Produces:
  - `type CandidatoConjuge = { id: number; nome: string; celular: string; casado: boolean; conjugeNome: string | null; conjugeCelular: string | null }`
  - `ligarConjuges(cands: CandidatoConjuge[]): Map<number, number>` — id do candidato → id do cônjuge também candidato. Simétrico.

- [ ] **Step 1: Write the failing tests:** (a) A informa celular do cônjuge = celular de B → `get(A) === B` e `get(B) === A`, mesmo se B marcou `casado: false`; (b) só o nome bate (sem acento e sem diferença de maiúsculas, `"José Silva"` x `"jose silva"`) → ligados; (c) A aponta para o celular de B e B para o de A → um único par; (d) celular do cônjuge de A igual ao celular de dois candidatos B e C → nenhuma ligação por celular, e se o nome de B bate, A liga só com B; (e) candidato não casado e sem ninguém apontando para ele → fora do mapa; (f) um candidato nunca liga consigo mesmo.
- [ ] **Step 2: Run** `npx tsx --test src/lib/servirConjuge.test.ts` — FAIL.
- [ ] **Step 3: Implement** `ligarConjuges`; comparar nomes com `normalize("NFD")` sem diacríticos, minúsculas e espaços colapsados.
- [ ] **Step 4: Run** — PASS.

### Task 4: Schema e migração

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Missao` e dois modelos novos)
- Create: `prisma/migrations/<timestamp>_servir_formulario/migration.sql` (gerada)

**Interfaces:**
- Produces (modelos Prisma): `Missao.servirPublicado Boolean @default(false)`, `Missao.servirDatas String?`, `Missao.candidatos Candidato[]`;
  `Candidato { id, missaoId, nome, celular, cpf, casado Boolean @default(false), conjugeNome String?, conjugeCelular String?, respostas String @default("[]"), disponivel Boolean, status String @default("PENDENTE"), servoId Int?, criadoEm DateTime @default(now()), atualizadoEm DateTime @updatedAt, @@unique([missaoId, cpf]), @@index([missaoId, status]) }` com relação a `Missao`;
  `PerguntaServir { id, ordem Int, titulo, tipo, obrigatoria Boolean @default(false), opcoes String?, permiteOutra Boolean @default(false), ativa Boolean @default(true) }` com `@@index([ordem])`.

- [ ] **Step 1:** Fazer backup: `cp prisma/quadrante.db prisma/quadrante.db.bak-antes-servir-formulario`.
- [ ] **Step 2:** Editar `schema.prisma` conforme Interfaces.
- [ ] **Step 3:** Gerar a migração sem tocar no banco real: `DATABASE_URL="file:/tmp/qd-servir-dev.db" npx prisma migrate dev --name servir_formulario`. Conferir que o `migration.sql` só tem `CREATE TABLE`, `CREATE INDEX`, `CREATE UNIQUE INDEX` e dois `ALTER TABLE "Missao" ADD COLUMN`.
- [ ] **Step 4:** `npx prisma generate` e `npx tsc --noEmit` — sem erros novos.
- [ ] **Step 5:** `npm test` — todos os testes existentes continuam passando (a migração aplica no banco temporário).

### Task 5: Perguntas no banco (conjunto inicial e edição)

**Files:**
- Create: `src/lib/servirPerguntasDb.ts`
- Test: `src/lib/servirPerguntasDb.test.ts`

**Interfaces:**
- Consumes: `PerguntaForm`, `TipoPergunta`, `TIPOS_PERGUNTA` (Task 2); modelos da Task 4.
- Produces (todas recebem `db: PrismaClient` primeiro):
  - `garantirPerguntasIniciais(db): Promise<void>` — cria as 8 perguntas abaixo só se `PerguntaServir` estiver vazia, numa transação
  - `listarPerguntasAtivas(db): Promise<PerguntaForm[]>` — ordem crescente
  - `listarPerguntasAdmin(db): Promise<(PerguntaForm & { ativa: boolean; ordem: number; temRespostas: boolean })[]>`
  - `type DadosPergunta = { titulo: string; tipo: TipoPergunta; obrigatoria: boolean; opcoes: string[]; permiteOutra: boolean }`
  - `criarPergunta(db, d: DadosPergunta): Promise<{ ok: true; id: number } | { ok: false; erro: string }>` — `ordem` = maior + 1
  - `atualizarPergunta(db, id: number, d: DadosPergunta): Promise<{ ok: true } | { ok: false; erro: string }>` — recusa troca de `tipo` se `temRespostas`
  - `moverPergunta(db, id: number, direcao: "cima" | "baixo"): Promise<void>` — troca a `ordem` com a vizinha
  - `definirPerguntaAtiva(db, id: number, ativa: boolean): Promise<void>`

Conjunto inicial (ordem 1 a 8, `obrigatoria` entre parênteses): 1 "Data de nascimento" `DATA` (sim); 2 "Você fez algum acampamento?" `SIM_NAO` (sim); 3 "Você fez o Acampamento Sênior no Sítio São Padre Pio? Se sim, selecione qual acampamento" `ESCOLHA_UMA` (não, `permiteOutra`), opções `"1º Sênior"` … `"23º Sênior"` mais `"Sênior de Palhoça - São Francisco de Assis"`, `"Sênior de São José - São José"`, `"Sênior - São Padre Pio - Forania de Santo Amaro"`, `"Sênior Geral (realizado fora do Sítio São Padre Pio)"`; 4 "Quais setores você já serviu?" `ESCOLHA_VARIAS` (não, `permiteOutra`), opções `Evangelização, Líder, Cozinha, Capela, Manutenção, Tropa, Cantinho Mariano, Teatro, Animação, Ligação, Música, Farmácia, Secretaria, Coordenação de Tropa, Coordenação de Evangelização, Coordenação de Líderes, Coordenação de Farmácia, Coordenação de Animação, Coordenação de Cozinha, Coordenação de Música, Auxiliar da Coordenação de Missão, Auxiliar de Líderes, Nunca fui servo`; 5 "Selecione a paróquia em que você serve" `ESCOLHA_UMA` (sim, `permiteOutra`), opções `Paróquia Santo Amaro, Paróquia São Francisco de Assis, Paróquia São Sebastião Anitápolis, Paróquia São Sebastião, Paróquia Judas Tadeu e São João Batista, Paróquia Sagrado Coração de Jesus - Paulo Lopes, Paróquia Nossa Senhora da Imaculada Conceição, Paróquia Nossa Senhora dos Navegantes e São Pedro, Paróquia Sagrado Coração de Jesus - Leoberto Leal, Paróquia Senhor Bom Jesus de Nazaré`; 6 "Participa de alguma pastoral?" `SIM_NAO` (sim); 7 "Se sim, qual?" `TEXTO_CURTO` (não); 8 "Em que ano você começou a servir em sua paróquia?" `NUMERO` (não).

- [ ] **Step 1: Write the failing tests** (banco temporário): `garantirPerguntasIniciais` cria 8 e uma segunda chamada continua com 8; `listarPerguntasAtivas` devolve `opcoes` como `string[]` e a pergunta 5 com `permiteOutra`; `moverPergunta(id, "cima")` troca com a anterior e na primeira não faz nada; `definirPerguntaAtiva(id, false)` a tira de `listarPerguntasAtivas` mas mantém em `listarPerguntasAdmin`; `criarPergunta` de escolha sem opções → `ok: false`; `atualizarPergunta` trocando `tipo` de pergunta que tem um `Candidato` com `"perguntaId":<id>,` em `respostas` → `ok: false`, sem respostas → `ok: true`; título vazio → `ok: false`.
- [ ] **Step 2: Run** `npx tsx --test src/lib/servirPerguntasDb.test.ts` — FAIL.
- [ ] **Step 3: Implement.** `opcoes` gravado como JSON; `temRespostas` = existe `Candidato` com `respostas contains '"perguntaId":<id>,'`. Opções aparadas, sem vazias e sem repetidas; só tipos de escolha guardam opções (exigem ao menos 1).
- [ ] **Step 4: Run** — PASS.

### Task 6: Candidatos (registrar, pessoas parecidas, aprovar, recusar)

**Files:**
- Create: `src/lib/liberacaoConflito.ts` (extraída de `actions.ts`)
- Modify: `src/lib/actions.ts` (apagar `validarELiberarCodigo` local e importar de `./liberacaoConflito`)
- Create: `src/lib/servirCandidatos.ts`
- Test: `src/lib/servirCandidatos.test.ts`

**Interfaces:**
- Consumes: `DadosFixos`, `RespostaSalva` (Task 2); `cpfReal`, `soDigitos` (Task 1); `checarConflitoServo` de `src/lib/conflitoServo.ts`; `normalizarNome`.
- Produces:
  - `liberacaoConflito.ts`: `validarELiberarCodigo(db: PrismaClient, pessoaId: number, missaoId: number, codigo: string | null): Promise<boolean>` (mesmo corpo da função privada de hoje, com `db` por parâmetro; `actions.ts` passa o seu `db`)
  - `registrarCandidato(db, e: { missaoId: number; fixos: DadosFixos; respostas: RespostaSalva[] }): Promise<{ novo: boolean }>` — upsert por `(missaoId, cpf)`; atualiza todos os campos; `status` volta a `PENDENTE` só se não era `APROVADO`; nunca mexe em `servoId`
  - `type PessoaParecida = { id: number; nome: string; celular: string | null; motivo: "cpf" | "nome" | "celular" }`
  - `pessoasParecidas(db, c: { cpf: string; nome: string; celular: string }): Promise<PessoaParecida[]>` — por CPF (compara só dígitos e só se `cpfReal`), por nome normalizado igual, por celular (só dígitos) igual; sem repetir pessoa; no máximo 8
  - `historicoDaPessoa(db, pessoaId: number): Promise<{ missao: string; setor: string; status: string }[]>`
  - `type ResultadoAprovar = { ok: true; servoId: number } | { ok: false; erro: string } | { ok: false; conflito: { missaoConflitoNome: string; distancia: number } }`
  - `aprovarCandidato(db, candidatoId: number, o: { setor: string; pessoaId: number | null; codigoLiberacao: string | null }): Promise<ResultadoAprovar>` — `pessoaId: null` cria `Pessoa` nova
  - `definirStatusCandidato(db, id: number, status: "RECUSADO" | "PENDENTE"): Promise<{ ok: true } | { ok: false; erro: string }>` — recusa se o candidato está `APROVADO`

`aprovarCandidato`: recusa `disponivel = false` (`erro: "Candidato indisponível."`), `status = "APROVADO"` (`"Já foi aprovado."`), setor vazio, e pessoa que já é `Servo` da missão (`"Já está no quadrante desta missão (setor X)."`). Ao criar `Pessoa`, copia `nome`, `celular` e `cpf` (só se `cpfReal`). Ao reaproveitar, preenche só campos vazios. Se `checarConflitoServo` achar conflito e `validarELiberarCodigo` falhar → `{ ok: false, conflito }` (ou `erro: "Código de liberação inválido ou expirado."` quando veio código). Cria `Servo { funcao: "INTEGRANTE", status: "ATIVO", confirmado: false }`, grava `servoId` e `APROVADO`, tudo numa transação.

- [ ] **Step 1: Write the failing tests** (banco temporário; criar `Missao` com `cercoSlug` único): `registrarCandidato` duas vezes com o mesmo CPF → 1 linha, segunda retorna `novo: false`; reenvio de `APROVADO` mantém `status` e `servoId` e atualiza `celular`; reenvio de `RECUSADO` volta a `PENDENTE`; `pessoasParecidas` acha por CPF `529.982.247-25` guardado com pontos, não acha por CPF `000.000.000-00`, acha por nome `"maria da silva"` contra `"Maria Da Silva"`, acha por celular; `aprovarCandidato` com `pessoaId: null` cria `Pessoa` e `Servo` e marca `APROVADO`; segunda aprovação → `ok: false`; `disponivel: false` → `ok: false` e nenhum `Servo`; pessoa já servo → erro com o setor; conflito de missões (duas missões com `mes`/`anoCalendario` a 1 mês, servo ATIVO na primeira) sem código → `conflito`, com código válido gravado em `liberacaoConflitoServo` → `ok: true`; `definirStatusCandidato` em `APROVADO` → `ok: false`.
- [ ] **Step 2: Run** `npx tsx --test src/lib/servirCandidatos.test.ts` — FAIL.
- [ ] **Step 3: Implement** os dois arquivos novos e a extração em `actions.ts`.
- [ ] **Step 4: Run** `npx tsx --test src/lib/servirCandidatos.test.ts` — PASS; depois `npm test` — tudo verde (a extração não quebra nada).

### Task 7: Server actions

**Files:**
- Create: `src/lib/actionsServir.ts` (`"use server"`)

**Interfaces:**
- Consumes: Tasks 1 a 6; `requireUser`, `requireRole`, `podeAcessarMissao` de `src/lib/auth.ts`; `excedeuLimite`, `ipDoCliente` de `src/lib/rateLimit.ts`; `db` de `src/lib/db.ts`.
- Produces (todas `async`):
  - `enviarCandidatura(_prev: unknown, formData: FormData): Promise<{ ok: true } | { error?: string; erros?: Record<string, string> }>` — **pública**. Campos do `FormData`: `missaoId`, `nome`, `cpf`, `celular`, `casado`, `conjugeNome`, `conjugeCelular`, `disponivel`, `lgpd` (`"on"` obrigatório), e por pergunta `p_<id>` (um ou mais valores) mais `p_<id>_outra`. Limite `excedeuLimite("servir:envio:" + ip, 10, 10 * 60_000)` com a mensagem do Cerco. Missão inexistente ou `servirPublicado = false` → `{ error: "Inscrições encerradas no momento." }`. Nunca devolve dados gravados.
  - `definirServirConfig(missaoId: number, publicado: boolean, datas: string): Promise<void>` — SUPER
  - `salvarPerguntaServir(_prev: unknown, formData: FormData)` — SUPER; `id` ausente cria; campos `titulo`, `tipo`, `obrigatoria`, `opcoes` (uma por linha), `permiteOutra`
  - `moverPerguntaServir(id: number, direcao: "cima" | "baixo")`, `ativarPerguntaServir(id: number, ativa: boolean)` — SUPER
  - `aprovarCandidatoServir(_prev: unknown, formData: FormData)` — `requireUser` + `podeAcessarMissao`; campos `candidatoId`, `setor`, `pessoaId` (vazio = nova), `codigoLiberacao`
  - `recusarCandidatoServir(candidatoId: number)`, `reabrirCandidatoServir(candidatoId: number)` — mesmo controle de acesso, confere que o candidato pertence a uma missão acessível
  - Todas as de admin chamam `revalidatePath` da página afetada.

- [ ] **Step 1:** Ler os dois guias do Next citados em Global Constraints.
- [ ] **Step 2:** Implementar as actions como camada fina sobre os módulos de `src/lib`. A de envio lê as perguntas com `garantirPerguntasIniciais` + `listarPerguntasAtivas`, monta `EntradaResposta` por pergunta, roda `validarFixos` e `validarRespostas`, e só então `registrarCandidato`.
- [ ] **Step 3: Verify:** `npx tsc --noEmit` e `npx eslint src/lib/actionsServir.ts` sem erros.

### Task 8: Página pública `/servir/[slug]`

**Files:**
- Create: `src/app/servir/[slug]/page.tsx`
- Create: `src/app/servir/[slug]/ServirForm.tsx` (cliente)

**Interfaces:**
- Consumes: `enviarCandidatura`, `garantirPerguntasIniciais`, `listarPerguntasAtivas`, `OUTRA`.

- [ ] **Step 1:** `page.tsx` segue `src/app/cerco/[slug]/page.tsx`: `params` é `Promise`, busca `Missao` por `cercoSlug`, `notFound()` se não existir, mesmo visual; se `servirPublicado` for falso mostra "Inscrições encerradas no momento." Senão passa a missão e as perguntas ativas ao `ServirForm`.
- [ ] **Step 2:** `ServirForm` com `useActionState(enviarCandidatura, null)`: campos fixos, "Você é casado(a)?" mostrando nome e celular do cônjuge só com "Sim", as perguntas na ordem (cada tipo com o controle adequado; escolha com `permiteOutra` ganha a opção "Outra" com campo de texto), pergunta final `Você pode servir no {nome}{ - servirDatas}?`, aviso "Responder não garante vaga na equipe." e a caixa de aceite de LGPD (texto: a Associação dos Campistas São Padre Pio guarda os dados para equipes futuras e não os compartilha). Erros aparecem junto de cada campo. Em `ok`, troca o formulário por "Recebemos sua resposta. Obrigado por se disponibilizar!".
- [ ] **Step 3: Verify:** `npx tsc --noEmit`; rodar o app de teste (Task 12) e abrir `/servir/<slug>` com `servirPublicado` ligado e desligado.

### Task 9: Editor de perguntas

**Files:**
- Create: `src/app/(admin)/configuracoes/perguntas-servir/page.tsx`
- Create: `src/app/(admin)/configuracoes/perguntas-servir/EditorPerguntas.tsx` (cliente)

- [ ] **Step 1:** `page.tsx` chama `await requireRole("SUPER")`, `garantirPerguntasIniciais(db)` e `listarPerguntasAdmin(db)`.
- [ ] **Step 2:** `EditorPerguntas`: lista com título, tipo, obrigatória, ativa; botões subir/descer (`moverPerguntaServir`), ativar/desativar, formulário de editar/criar (`salvarPerguntaServir`) com `opcoes` em textarea (uma por linha). O seletor de tipo fica desabilitado, com aviso, quando `temRespostas`.
- [ ] **Step 3: Verify:** `npx tsc --noEmit`; no app de teste, criar uma pergunta, torná-la opcional, reordenar e desativar; ela some/aparece em `/servir/<slug>`.

### Task 10: Configurações (abrir candidaturas, datas, links)

**Files:**
- Create: `src/app/(admin)/configuracoes/ServirConfig.tsx` (cliente)
- Modify: `src/app/(admin)/configuracoes/page.tsx` (nova seção depois do bloco do Cerco)

- [ ] **Step 1:** Seção "Candidatos a servir" para a missão ativa: botão publicar/tirar do ar e campo `servirDatas` (via `definirServirConfig`), link público copiável `/servir/{cercoSlug}`, link para `/configuracoes/perguntas-servir` e link para `/candidatos`. Padrão visual e de botão de `CercoPublicoToggle.tsx`.
- [ ] **Step 2: Verify:** `npx tsc --noEmit`; no app de teste, ligar, ver a página pública abrir, desligar.

### Task 11: Triagem `/candidatos` e exportação

**Files:**
- Create: `src/app/(admin)/candidatos/page.tsx`
- Create: `src/app/(admin)/candidatos/LinhaCandidato.tsx` (cliente)
- Create: `src/app/(admin)/candidatos/exportar/route.ts`

**Interfaces:**
- Consumes: `ligarConjuges`, `pessoasParecidas`, `historicoDaPessoa`, actions da Task 7, `getMissaoAtiva`, `ordenarSetores` e `FUNCOES`-style helpers de `src/lib/constants.ts`.

- [ ] **Step 1:** `page.tsx` chama `await requireUser()` e `getMissaoAtiva()`; lê candidatos da missão com `searchParams` (`Promise`) para `status` (padrão `PENDENTE`), `disponivel` e `q` (nome); contadores por status e não disponíveis. Os filtros por pergunta de escolha usam as `respostas` já carregadas, em memória. Para cada candidato calcula `ligarConjuges` sobre **todos** os candidatos da missão, e para os `PENDENTE` carrega `pessoasParecidas` e `historicoDaPessoa`.
- [ ] **Step 2:** `LinhaCandidato`: nome, celular, disponibilidade, cônjuge ("Cônjuge: X (também é candidato nesta missão)" com atalho para a outra linha quando ligado; senão "Cônjuge informado: nome, celular"), respostas expansíveis, histórico. **Aprovar**: escolhe o setor entre os de `Setor`, escolhe uma pessoa parecida ou "criar nova", e confirma (`aprovarCandidatoServir`); em `conflito`, mostra o aviso, o botão para chamar `solicitarLiberacaoConflito(pessoaId, missaoId)` (action já existente em `actions.ts`) e o campo do código. **Recusar** e **Reabrir**. Aprovar fica desabilitado para `disponivel = false` e mostra "já está no quadrante" quando aplicável.
- [ ] **Step 3:** `exportar/route.ts` (`GET`, `requireUser()`), no estilo de `servos/exportar/route.ts`: uma planilha com nome, CPF, celular, status, disponível, cônjuge e uma coluna por pergunta ativa.
- [ ] **Step 4: Verify:** `npx tsc --noEmit`; no app de teste, enviar duas candidaturas de um casal (uma com o celular do cônjuge igual ao da outra) e conferir a ligação nas duas linhas; aprovar uma e ver o `Servo` em `/servos`; baixar o Excel.

### Task 12: Limpeza ao excluir missão e verificação completa

**Files:**
- Modify: `src/lib/actions.ts` (`excluirMissao`, dentro de `db.$transaction([...])`)

- [ ] **Step 1:** Em `excluirMissao`, antes de `db.servo.deleteMany`, acrescentar `db.candidato.deleteMany({ where: { missaoId: id } })`.
- [ ] **Step 2:** Rodar `npm test` — todos os testes passam, incluindo `protecao-paginas.test.ts` com as páginas e a rota novas de `(admin)`.
- [ ] **Step 3:** Rodar `npx eslint src` e `npx tsc --noEmit` — sem erros novos.
- [ ] **Step 4:** Rodar `npm run build` — conclui sem erros.
- [ ] **Step 5: Verificação manual numa cópia do banco.** `cp prisma/quadrante.db /tmp/qd-servir-copia.db`; aplicar a migração com `DATABASE_URL="file:/tmp/qd-servir-copia.db" npx prisma migrate deploy`; subir `DATABASE_URL="file:/tmp/qd-servir-copia.db" npx next start -p 3011` em segundo plano; percorrer: abrir a missão, enviar candidatura (com e sem cônjuge, CPF inválido, reenvio com o mesmo CPF), conferir triagem, aprovar, recusar, excluir uma missão de teste e ver que os candidatos somem. Parar o servidor.

### Task 13: Liberação (só quando o dono disser "liberar")

- [ ] **Step 1:** Backup: `cp prisma/quadrante.db prisma/quadrante.db.bak-antes-servir-formulario-deploy`.
- [ ] **Step 2:** `npx prisma migrate deploy`, depois `npm run build`.
- [ ] **Step 3:** `pm2 restart quadrante && pm2 save`.
- [ ] **Step 4:** Abrir `/servir/<slug>` pelo domínio público e confirmar que, com `servirPublicado` desligado, mostra "Inscrições encerradas no momento."
- [ ] **Step 5 (se o dono pedir):** item "Candidatos a servir" no menu lateral (`NAV` em `src/app/(admin)/layout.tsx`, `NAV_ICONE` em `AdminShell.tsx`) e notificação Pushbird de novo candidato (coluna nova em `PushbirdDevice`).
