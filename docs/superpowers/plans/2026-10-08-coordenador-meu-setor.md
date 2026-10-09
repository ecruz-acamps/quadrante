# Perfil COORDENADOR (`/meu-setor`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada coordenador um login que só enxerga os servos do setor dele e permite marcar cada um como Sim, Não ou Desistiu.

**Architecture:** Novo valor `COORDENADOR` em `Usuario.role` e coluna `Usuario.setor`. O sistema atual passa a recusar esse perfil por padrão: `requireUser()` redireciona o coordenador para `/meu-setor` e `getMissaoAtiva()` devolve `null` para ele. Só `requireCoordenador()`, usada pela página nova e pela ação `marcarStatusServo`, o aceita. As regras (quem pode marcar o quê) ficam em um módulo puro e testável, `src/lib/coordenador.ts`.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 6 + SQLite, TypeScript, `node:test` rodado com `tsx` (sem dependência nova).

**Spec:** `docs/superpowers/specs/2026-10-08-coordenador-meu-setor-design.md`

## Global Constraints

- Este Next.js tem mudanças incompatíveis (ver `AGENTS.md`): antes de escrever código novo que use APIs do Next, consulte `node_modules/next/dist/docs/`. Neste plano só se usam `redirect`, `cookies`, `revalidatePath` e server actions, já usados no projeto.
- Perfis válidos de `Usuario.role`: `SUPER`, `ADMIN`, `COORDENADOR` (strings exatas).
- Status válidos de servo: `ATIVO` (= "Sim"), `RECUSOU` (= "Não"), `DESISTIU`.
- Cada coordenador tem **exatamente um setor** (nome igual a `Setor.nome` e a `Servo.setor`) e uma ou mais missões em `UsuarioMissao`.
- O coordenador só altera `status`, `motivoRecusou` e `motivoDesistiu`. Nenhum outro campo.
- Backup do banco antes de migrar, no padrão `prisma/quadrante.db.bak-antes-<nome>`.
- Textos de interface em português.
- Há alterações de hoje ainda sem commit no repositório (busca por setor, Formação, Financeiro, `src/lib/busca.ts`, `ecosystem.config.cjs`). Os commits deste plano usam `git add` com caminhos explícitos e nunca `git add -A`.

## Ajustes em relação ao spec

Duas decisões tomadas ao escrever o plano; o spec foi atualizado para refletir:

1. `requireCoordenador()` exige apenas o perfil e **não redireciona** quando faltam setor ou missão: devolve `setor` e `missao` como `null`, e a página mostra a mensagem de cadastro incompleto (evita loop de redirecionamento). A ação `marcarStatusServo` é quem recusa quando faltam.
2. A missão do coordenador é a **mais recente entre as vinculadas**; não há seletor de missão para ele.

## Atualização do plano (2026-10-09)

O código mudou depois que este plano foi escrito (pacote de segurança, backup, cache de sessão). Valem estas correções, que prevalecem sobre o texto das tasks:

- `package.json` **já tem** o script `test` (`tsx --test src/lib/*.test.ts`) e existe `src/lib/testdb.ts` (banco temporário para testes). Não recriar.
- `src/lib/auth.ts` agora declara `getSessionUserId`, `requireUser`, `getMissaoAtiva` e `getMissoesPermitidas` como `export const x = cache(async (...) => { ... })` (React `cache`, uma execução por requisição). `podeAcessarMissao` mora em `src/lib/autorizacao.ts` e é reexportada por `auth.ts`.
- Já existem `acessoRegistros`, `exigirRegistros`, `exigirMissao` e `podeAcessarMissao` em `src/lib/autorizacao.ts`; `src/app/(admin)/servos/[id]/page.tsx` e `fichas/[id]/page.tsx` **já** chamam `requireUser`.
- Senha mínima de usuário agora é **10** caracteres (`criarUsuario`/`atualizarUsuario`).
- A migração é escrita **à mão** (nunca `prisma migrate dev`, que pode propor reset do banco); conferir com `prisma migrate diff ... --exit-code`.
- Trabalho na branch `coordenador-meu-setor`; merge na `main`, push e deploy só com ok do usuário.

## Review Focus

- Coordenador sem setor ou sem missão: a página mostra a mensagem, e a ação recusa sem gravar (Tasks 1 e 4).
- `servoId` inexistente, `NaN` ou não numérico: a ação devolve erro, sem lançar exceção (Task 4).
- Motivo só com espaços, vazio ou enorme: vira `null` ou é cortado em 500 caracteres (Task 1).
- Voltar um servo para "Sim" (`ATIVO`) limpa os dois motivos antigos (Task 1).
- Trocar o perfil de COORDENADOR para ADMIN ou SUPER limpa o setor; setor que não existe em `Setor` é rejeitado (Task 5).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/coordenador.ts` (novo) | Regras puras: `statusValido`, `podeMarcarServo`, `dadosDoStatus`, `normalizarRole`. Sem Prisma nem Next. |
| `src/lib/coordenador.test.ts` (novo) | Testes das regras puras. |
| `src/lib/protecao-paginas.test.ts` (novo) | Varredura: toda página/rota sob `(admin)` (fora `meu-setor`) chama `requireUser`/`requireRole`/`requireCoordenador`. |
| `prisma/schema.prisma` | Coluna `Usuario.setor`. |
| `src/lib/auth.ts` | `requireQualquerUsuario`, `requireUser` (bloqueia coordenador), `getMissaoAtiva` (null p/ coordenador), `getContextoCoordenador`, `requireCoordenador`. |
| `src/app/(admin)/layout.tsx` | Usa `requireQualquerUsuario`; menu reduzido para coordenador. |
| `src/app/(admin)/AdminShell.tsx` | Ícone de `/meu-setor`. |
| 13 páginas/rotas em `(admin)` | Primeira linha: `await requireUser();`. |
| `src/lib/actions.ts` | `marcarStatusServo`; `criarUsuario`/`atualizarUsuario` aceitam COORDENADOR. |
| `src/app/(admin)/meu-setor/page.tsx` (novo) | Lista do setor. |
| `src/app/(admin)/meu-setor/StatusServoButtons.tsx` (novo) | Botões Sim/Não/Desistiu com modal de motivo. |
| `src/app/(admin)/usuarios/*` | Formulários e lista com o perfil Coordenador e seletor de setor. |
| `scripts/_coordenador-teste.ts` (novo) | Cria/remove um coordenador de teste e imprime o cookie de sessão (verificação manual). |

---

### Task 1: Regras puras e infraestrutura de teste

**Files:**
- Create: `src/lib/coordenador.ts`
- Create: `src/lib/coordenador.test.ts`

**Interfaces:**
- Produces (usado pelas Tasks 4 e 5):
  - `STATUS_SERVO: readonly ["ATIVO","RECUSOU","DESISTIU"]`
  - `type StatusServo`
  - `MOTIVO_MAX: 500`
  - `statusValido(v: unknown): v is StatusServo`
  - `podeMarcarServo(c: { setor: string | null; missaoIds: number[] }, s: { setor: string; missaoId: number }): boolean`
  - `dadosDoStatus(status: StatusServo, motivo?: string | null): { status: StatusServo; motivoRecusou: string | null; motivoDesistiu: string | null }`
  - `normalizarRole(v: unknown): "SUPER" | "ADMIN" | "COORDENADOR"`

- [x] **Step 1: (já existe)** O script `npm test` e `src/lib/testdb.ts` já estão no repositório. Nada a fazer.

- [ ] **Step 2: Escrever os testes que falham**

Crie `src/lib/coordenador.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { statusValido, podeMarcarServo, dadosDoStatus, normalizarRole, MOTIVO_MAX } from "./coordenador";

test("statusValido aceita só os três status exatos", () => {
  for (const s of ["ATIVO", "RECUSOU", "DESISTIU"]) assert.equal(statusValido(s), true);
  for (const s of ["ativo", "", "SIM", "NAO", null, undefined, 1, {}]) assert.equal(statusValido(s), false);
});

test("podeMarcarServo: mesmo setor e missão vinculada", () => {
  const c = { setor: "TROPA", missaoIds: [98, 95] };
  assert.equal(podeMarcarServo(c, { setor: "TROPA", missaoId: 98 }), true);
  assert.equal(podeMarcarServo(c, { setor: "TROPA", missaoId: 95 }), true);
});

test("podeMarcarServo: recusa outro setor, outra missão, setor nulo e sem missões", () => {
  assert.equal(podeMarcarServo({ setor: "TROPA", missaoIds: [98] }, { setor: "SECRETARIA", missaoId: 98 }), false);
  assert.equal(podeMarcarServo({ setor: "TROPA", missaoIds: [98] }, { setor: "TROPA", missaoId: 12 }), false);
  assert.equal(podeMarcarServo({ setor: null, missaoIds: [98] }, { setor: "TROPA", missaoId: 98 }), false);
  assert.equal(podeMarcarServo({ setor: "TROPA", missaoIds: [] }, { setor: "TROPA", missaoId: 98 }), false);
});

test("podeMarcarServo compara o setor exatamente (sem ignorar maiúscula)", () => {
  assert.equal(podeMarcarServo({ setor: "TROPA", missaoIds: [98] }, { setor: "tropa", missaoId: 98 }), false);
});

test("dadosDoStatus: ATIVO limpa os dois motivos", () => {
  assert.deepEqual(dadosDoStatus("ATIVO", "qualquer"), { status: "ATIVO", motivoRecusou: null, motivoDesistiu: null });
});

test("dadosDoStatus: RECUSOU e DESISTIU gravam só o motivo do próprio status", () => {
  assert.deepEqual(dadosDoStatus("RECUSOU", "viagem"), { status: "RECUSOU", motivoRecusou: "viagem", motivoDesistiu: null });
  assert.deepEqual(dadosDoStatus("DESISTIU", "doença"), { status: "DESISTIU", motivoRecusou: null, motivoDesistiu: "doença" });
});

test("dadosDoStatus: motivo com espaços, vazio ou ausente vira null", () => {
  assert.equal(dadosDoStatus("RECUSOU", "   ").motivoRecusou, null);
  assert.equal(dadosDoStatus("RECUSOU", "").motivoRecusou, null);
  assert.equal(dadosDoStatus("RECUSOU").motivoRecusou, null);
  assert.equal(dadosDoStatus("RECUSOU", null).motivoRecusou, null);
  assert.equal(dadosDoStatus("DESISTIU", "  trabalho  ").motivoDesistiu, "trabalho");
});

test("dadosDoStatus: motivo gigante é cortado em MOTIVO_MAX", () => {
  const r = dadosDoStatus("DESISTIU", "a".repeat(MOTIVO_MAX + 200));
  assert.equal(r.motivoDesistiu?.length, MOTIVO_MAX);
});

test("normalizarRole: só SUPER e COORDENADOR são preservados, o resto vira ADMIN", () => {
  assert.equal(normalizarRole("SUPER"), "SUPER");
  assert.equal(normalizarRole("COORDENADOR"), "COORDENADOR");
  assert.equal(normalizarRole("ADMIN"), "ADMIN");
  for (const v of ["super", "", null, undefined, "ROOT", 3]) assert.equal(normalizarRole(v), "ADMIN");
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd /home/true/quadrante/app && npm test`
Expected: FAIL com `Cannot find module './coordenador'`.

- [ ] **Step 4: Implementar o módulo**

Crie `src/lib/coordenador.ts`:

```ts
// Regras do perfil COORDENADOR. Módulo puro (sem Prisma nem Next) para ser testado direto.

export const STATUS_SERVO = ["ATIVO", "RECUSOU", "DESISTIU"] as const;
export type StatusServo = (typeof STATUS_SERVO)[number];

export const MOTIVO_MAX = 500;

export function statusValido(v: unknown): v is StatusServo {
  return typeof v === "string" && (STATUS_SERVO as readonly string[]).includes(v);
}

// o coordenador só mexe em servo do setor dele e de uma missão vinculada a ele
export function podeMarcarServo(
  coordenador: { setor: string | null; missaoIds: number[] },
  servo: { setor: string; missaoId: number },
): boolean {
  if (!coordenador.setor) return false;
  return servo.setor === coordenador.setor && coordenador.missaoIds.includes(servo.missaoId);
}

// único conjunto de campos que a ação do coordenador pode gravar
export function dadosDoStatus(status: StatusServo, motivo?: string | null) {
  const texto = (motivo ?? "").trim().slice(0, MOTIVO_MAX) || null;
  return {
    status,
    motivoRecusou: status === "RECUSOU" ? texto : null,
    motivoDesistiu: status === "DESISTIU" ? texto : null,
  };
}

export type Role = "SUPER" | "ADMIN" | "COORDENADOR";

export function normalizarRole(v: unknown): Role {
  return v === "SUPER" || v === "COORDENADOR" ? v : "ADMIN";
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd /home/true/quadrante/app && npm test`
Expected: PASS, 9 testes, 0 falhas.

- [ ] **Step 6: Commit**

```bash
cd /home/true/quadrante/app
git add src/lib/coordenador.ts src/lib/coordenador.test.ts
git commit -m "feat(coordenador): regras puras de status/setor e script de teste"
```

---

### Task 2: Coluna `Usuario.setor` (migração)

**Files:**
- Modify: `prisma/schema.prisma:18-27`
- Create: `prisma/migrations/<timestamp>_usuario_setor_coordenador/migration.sql` (gerado)

**Interfaces:**
- Produces: `Usuario.setor: string | null` no Prisma Client (usado pelas Tasks 3, 4, 5).

- [ ] **Step 1: Backup do banco**

Run: `cd /home/true/quadrante/app && cp prisma/quadrante.db prisma/quadrante.db.bak-antes-coordenador && chmod 600 prisma/quadrante.db.bak-antes-coordenador && ls -la prisma/quadrante.db.bak-antes-coordenador`
Expected: arquivo listado com tamanho igual ao de `prisma/quadrante.db`.

- [ ] **Step 2: Conferir que as migrações estão em dia**

Run: `cd /home/true/quadrante/app && npx prisma migrate status`
Expected: `Database schema is up to date!`. Se não estiver, pare e investigue antes de seguir.

- [ ] **Step 3: Editar o schema**

Em `prisma/schema.prisma`, no model `Usuario`, troque a linha do `role` e acrescente o `setor`:

```prisma
  role  String  @default("ADMIN") // SUPER | ADMIN | COORDENADOR
  setor String? // só para COORDENADOR: nome do setor (igual a Setor.nome / Servo.setor)
```

- [ ] **Step 4: Escrever e aplicar a migração à mão**

Não use `prisma migrate dev` (pode propor reset do banco). Crie `prisma/migrations/20261009000000_usuario_setor_coordenador/migration.sql` com exatamente:

```sql
-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "setor" TEXT;
```

Confirme que migrações e schema batem e aplique:

Run: `cd /home/true/quadrante/app && npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "file:$TMPDIR/shadow.db" --exit-code && npx prisma migrate deploy && npx prisma generate`
Expected: `No difference detected.`, depois `All migrations have been successfully applied.` e o client regenerado.

- [ ] **Step 5: Conferir tipos**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
cd /home/true/quadrante/app
git add prisma/schema.prisma prisma/migrations/20261009000000_usuario_setor_coordenador
git commit -m "feat(coordenador): coluna Usuario.setor"
```

---

### Task 3: Autorização em `auth.ts` e layout

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/(admin)/layout.tsx`
- Modify: `src/app/(admin)/AdminShell.tsx` (mapa `NAV_ICONE`)

**Interfaces:**
- Consumes: `Usuario.setor` (Task 2).
- Produces (usados pelas Tasks 4 e 5):
  - `requireQualquerUsuario(): Promise<Usuario>`: exige login, aceita qualquer perfil.
  - `requireUser(): Promise<Usuario>`: igual, mas coordenador é redirecionado para `/meu-setor`.
  - `getContextoCoordenador(user: { id: number; setor: string | null }): Promise<{ setor: string | null; missao: Missao | null; missaoIds: number[] }>`
  - `requireCoordenador(): Promise<{ usuario: Usuario; setor: string | null; missao: Missao | null; missaoIds: number[] }>`: só coordenador; qualquer outro perfil vai para `/`.

> Esta task não tem teste unitário (usa `next/headers` e o banco). É verificada por `tsc` aqui e pela verificação manual da Task 7.

- [ ] **Step 1: Separar `requireQualquerUsuario` de `requireUser`**

Em `src/lib/auth.ts`, hoje `requireUser` é `export const requireUser = cache(async () => { ... })`, com o corpo: pega `getSessionUserId()`, redireciona para `/login` se não houver, busca o usuário e devolve. Substitua esse bloco inteiro por:

```ts
// exige login; aceita qualquer perfil (usada pelo layout e por requireCoordenador)
export const requireQualquerUsuario = cache(async () => {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  const user = await db.usuario.findUnique({ where: { id } });
  if (!user) redirect("/login");
  return user;
});

// páginas e ações do sistema: o coordenador só tem acesso a /meu-setor
export const requireUser = cache(async () => {
  const user = await requireQualquerUsuario();
  if (user.role === "COORDENADOR") redirect("/meu-setor");
  return user;
});
```

(Preserve o `cache` importado de `"react"` que já existe no topo do arquivo.)

- [ ] **Step 2: Bloquear o coordenador em `getMissaoAtiva`**

Em `getMissaoAtiva` (que é `export const getMissaoAtiva = cache(async () => { ... })`), logo depois de `if (!user) return null;`, acrescente:

```ts
  if (user.role === "COORDENADOR") return null; // coordenador não usa o sistema geral, só /meu-setor
```

- [ ] **Step 3: Adicionar o contexto e `requireCoordenador`**

No fim de `src/lib/auth.ts`, acrescente:

```ts
// ---------- coordenador ----------
// missão do coordenador = a mais recente entre as vinculadas (sem seletor)
export async function getContextoCoordenador(user: { id: number; setor: string | null }) {
  const missoes = await getMissoesPermitidas(user.id); // já ordenadas por id desc
  return { setor: user.setor, missao: missoes[0] ?? null, missaoIds: missoes.map((m) => m.id) };
}

// única porta de entrada do perfil COORDENADOR. Outro perfil volta para o início.
// Não redireciona quando faltam setor ou missão: a página mostra o aviso de cadastro incompleto.
export const requireCoordenador = cache(async () => {
  const usuario = await requireQualquerUsuario();
  if (usuario.role !== "COORDENADOR") redirect("/");
  return { usuario, ...(await getContextoCoordenador(usuario)) };
});
```

- [ ] **Step 4: Layout com menu reduzido para o coordenador**

Em `src/app/(admin)/layout.tsx`, troque o import e o início do componente:

```tsx
import { requireQualquerUsuario, getMissaoAtiva, getMissoesPermitidas, getContextoCoordenador } from "@/lib/auth";
```

e, dentro de `AdminLayout`, substitua `const user = await requireUser();` por:

```tsx
  const user = await requireQualquerUsuario();
  if (user.role === "COORDENADOR") {
    const { missao: missaoCoord } = await getContextoCoordenador(user);
    return (
      <AdminShell
        nav={[["/meu-setor", "Meu setor", false]]}
        userNome={user.nome}
        missaoNome={missaoCoord?.nome ?? null}
        missaoId={missaoCoord?.id ?? null}
        mostrarSeletor={false}
        missoes={[]}
        selecionarMissaoAction={selecionarMissao}
        logoutAction={logoutAction}
      >
        {children}
      </AdminShell>
    );
  }
```

- [ ] **Step 5: Ícone do menu**

Em `src/app/(admin)/AdminShell.tsx`, dentro de `NAV_ICONE`, acrescente a linha `"/meu-setor": "users",` depois de `"/": "home",`.

- [ ] **Step 6: Conferir tipos e lint**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit -p . && npx eslint src/lib/auth.ts "src/app/(admin)/layout.tsx" "src/app/(admin)/AdminShell.tsx"`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
cd /home/true/quadrante/app
git add src/lib/auth.ts "src/app/(admin)/layout.tsx" "src/app/(admin)/AdminShell.tsx"
git commit -m "feat(coordenador): requireCoordenador, bloqueio por padrão e menu reduzido"
```

---

### Task 4: Proteger as 13 páginas e criar `/meu-setor` com a ação

**Files:**
- Create: `src/lib/protecao-paginas.test.ts`
- Modify (uma linha `await requireUser();` cada): `src/app/(admin)/page.tsx`, `cidades/page.tsx`, `formacao/page.tsx`, `cerco-dashboard/page.tsx`, `cerco-dashboard/exportar/route.ts`, `registros/page.tsx`, `fichas/page.tsx`, `fichas/novo/page.tsx`, `tribos/page.tsx`, `camisetas/page.tsx`, `financeiro/page.tsx`, `setores/page.tsx`, `servos/novo/page.tsx` (todos sob `src/app/(admin)/`; `fichas/[id]` e `servos/[id]` já foram protegidos)
- Modify: `src/lib/actions.ts` (ação `marcarStatusServo`)
- Create: `src/app/(admin)/meu-setor/page.tsx`
- Create: `src/app/(admin)/meu-setor/StatusServoButtons.tsx`

**Interfaces:**
- Consumes: `requireUser`, `requireCoordenador` (Task 3); `statusValido`, `podeMarcarServo`, `dadosDoStatus` (Task 1).
- Produces: `marcarStatusServo(servoId: number, status: string, motivo?: string): Promise<{ ok: true } | { error: string }>` e a rota `/meu-setor`.

- [ ] **Step 1: Escrever o teste de varredura (falha primeiro)**

Crie `src/lib/protecao-paginas.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// roda a partir da raiz do app (npm test)
const RAIZ = join(process.cwd(), "src", "app", "(admin)");
const EXIGE_AUTH = /\b(requireUser|requireRole|requireCoordenador)\(/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return nome === "page.tsx" || nome === "route.ts" ? [caminho] : [];
  });
}

test("toda página e rota de (admin) confere o usuário por conta própria", () => {
  const todos = arquivos(RAIZ);
  assert.ok(todos.length >= 20, `varredura achou só ${todos.length} arquivos; caminho errado?`);
  const sem = todos
    .filter((f) => !f.includes(`${join("(admin)", "meu-setor")}`))
    .filter((f) => !EXIGE_AUTH.test(readFileSync(f, "utf8")))
    .map((f) => relative(RAIZ, f));
  assert.deepEqual(sem, [], `sem requireUser/requireRole: ${sem.join(", ")}`);
});
```

- [ ] **Step 2: Rodar e confirmar que falha listando os 15 arquivos**

Run: `cd /home/true/quadrante/app && npm test`
Expected: o teste `toda página e rota...` FALHA e a mensagem lista exatamente `page.tsx`, `cidades/page.tsx`, `formacao/page.tsx`, `cerco-dashboard/page.tsx`, `cerco-dashboard/exportar/route.ts`, `registros/page.tsx`, `fichas/page.tsx`, `fichas/novo/page.tsx`, `tribos/page.tsx`, `camisetas/page.tsx`, `financeiro/page.tsx`, `setores/page.tsx`, `servos/novo/page.tsx` (13 arquivos). Os testes da Task 1 continuam passando.

- [ ] **Step 3: Proteger as 13 páginas**

Para cada arquivo da lista, faça duas coisas:

1. No import de `@/lib/auth`, acrescente `requireUser`. Exemplo: `import { getMissaoAtiva } from "@/lib/auth";` vira `import { getMissaoAtiva, requireUser } from "@/lib/auth";`. Se algum arquivo ainda não importar de `@/lib/auth`, acrescente `import { requireUser } from "@/lib/auth";` junto dos outros imports.
2. Insira `await requireUser();` como **primeira linha do corpo** da função exportada (`export default async function ...` ou `export async function GET`). Exemplo em `financeiro/page.tsx`:

```tsx
export default async function FinanceiroPage() {
  await requireUser();
  const missao = await getMissaoAtiva();
```

Em `tribos/page.tsx`, a função exportada é `TribosPage` (linha ~41), não o helper que vem antes dela.

- [ ] **Step 4: Rodar a varredura e confirmar que passa**

Run: `cd /home/true/quadrante/app && npm test && npx tsc --noEmit -p .`
Expected: PASS em todos os testes; `tsc` sem erros.

- [ ] **Step 5: Ação `marcarStatusServo`**

Em `src/lib/actions.ts`, acrescente `requireCoordenador` ao import de `"./auth"` e adicione (junto dos outros imports de `./`):

```ts
import { statusValido, podeMarcarServo, dadosDoStatus } from "./coordenador";
```

Depois de `marcarRecusou` (linha ~581), acrescente:

```ts
// ---------- coordenador: marca sim / não / desistiu nos servos do próprio setor ----------
export async function marcarStatusServo(servoId: number, status: string, motivo?: string) {
  const { setor, missaoIds } = await requireCoordenador();
  if (!Number.isInteger(servoId)) return { error: "Servo inválido." } as const;
  if (!statusValido(status)) return { error: "Status inválido." } as const;

  const servo = await db.servo.findUnique({
    where: { id: servoId },
    select: { id: true, setor: true, missaoId: true },
  });
  if (!servo || !podeMarcarServo({ setor, missaoIds }, servo)) {
    return { error: "Servo não encontrado no seu setor." } as const;
  }

  await db.servo.update({ where: { id: servo.id }, data: dadosDoStatus(status, motivo) });
  revalidatePath("/meu-setor");
  revalidatePath("/servos");
  revalidatePath("/registros");
  return { ok: true } as const;
}
```

- [ ] **Step 6: Componente dos botões**

Crie `src/app/(admin)/meu-setor/StatusServoButtons.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarStatusServo } from "@/lib/actions";

type Status = "ATIVO" | "RECUSOU" | "DESISTIU";

const BOTOES: { status: Status; rotulo: string; pergunta: string | null; ativo: string }[] = [
  { status: "ATIVO", rotulo: "Sim", pergunta: null, ativo: "bg-green-600/10 border-green-600 text-green-700" },
  { status: "RECUSOU", rotulo: "Não", pergunta: "Por que a pessoa não vai servir?", ativo: "bg-[var(--signal)]/10 border-[var(--signal)] text-[var(--signal)]" },
  { status: "DESISTIU", rotulo: "Desistiu", pergunta: "Por que a pessoa desistiu?", ativo: "bg-[var(--signal)]/10 border-[var(--signal)] text-[var(--signal)]" },
];

export default function StatusServoButtons({ servoId, status, motivo }: { servoId: number; status: string; motivo: string | null }) {
  const router = useRouter();
  const [pedindo, setPedindo] = useState<Status | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function gravar(novo: Status, motivoTexto?: string) {
    setEnviando(true);
    setErro("");
    const r = await marcarStatusServo(servoId, novo, motivoTexto);
    setEnviando(false);
    if ("error" in r) {
      setErro(r.error);
      return;
    }
    setPedindo(null);
    setTexto("");
    router.refresh();
  }

  const pergunta = BOTOES.find((b) => b.status === pedindo)?.pergunta;

  return (
    <div>
      <div className="flex items-center gap-1">
        {BOTOES.map((b) => (
          <button
            key={b.status}
            type="button"
            disabled={enviando}
            onClick={() => (b.pergunta ? setPedindo(b.status) : gravar(b.status))}
            className={`px-2 py-1 text-xs rounded border ${
              status === b.status ? b.ativo : "border-[var(--line)] text-[var(--ink-soft)]/70 hover:border-[var(--ink)]"
            }`}
          >
            {b.rotulo}
          </button>
        ))}
      </div>
      {status !== "ATIVO" && motivo && <p className="mt-1 text-xs text-[var(--ink-soft)]/70">{motivo}</p>}
      {erro && <p className="mt-1 text-xs text-[var(--signal)]">{erro}</p>}

      {pedindo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPedindo(null);
          }}
        >
          <div className="card w-full max-w-sm p-5 space-y-4">
            <p className="text-sm text-[var(--ink)]">{pergunta}</p>
            <textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Motivo (opcional)"
              rows={3}
              maxLength={500}
              className="input w-full"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPedindo(null)} className="btn-link text-sm">
                Cancelar
              </button>
              <button type="button" onClick={() => gravar(pedindo, texto)} disabled={enviando} className="btn-primary px-4 py-1.5 text-sm">
                {enviando ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Página `/meu-setor`**

Crie `src/app/(admin)/meu-setor/page.tsx`:

```tsx
import { requireCoordenador } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES } from "@/lib/constants";
import StatusServoButtons from "./StatusServoButtons";

export default async function MeuSetorPage() {
  const { setor, missao } = await requireCoordenador();

  if (!setor || !missao) {
    return (
      <div className="max-w-2xl">
        <h1 className="page-title mb-4">Meu setor</h1>
        <p className="text-sm text-[var(--ink-soft)]/70">
          Seu acesso ainda não está completo. Peça ao administrador para definir o seu setor e a sua missão.
        </p>
      </div>
    );
  }

  const servos = await db.servo.findMany({
    where: { missaoId: missao.id, setor },
    include: { pessoa: true },
  });
  const ordem = (f: string) => {
    const i = FUNCOES.indexOf(f);
    return i === -1 ? FUNCOES.length : i;
  };
  servos.sort((a, b) => ordem(a.funcao) - ordem(b.funcao) || a.pessoa.nome.localeCompare(b.pessoa.nome));

  return (
    <div className="max-w-4xl">
      <h1 className="page-title mb-1">Meu setor</h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]/70">
        {setor} · {missao.nome} · {servos.length} {servos.length === 1 ? "servo" : "servos"}
      </p>

      {servos.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]/60">Nenhum servo neste setor ainda.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="qd-thead">
              <tr>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Função</th>
                <th className="text-left px-4 py-2">Celular</th>
                <th className="text-left px-4 py-2">Camiseta</th>
                <th className="text-left px-4 py-2">Vai servir?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {servos.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2">{s.pessoa.nome}</td>
                  <td className="px-4 py-2">{s.funcao}</td>
                  <td className="px-4 py-2">{s.pessoa.celular ?? "—"}</td>
                  <td className="px-4 py-2">{s.camiseta ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusServoButtons
                      servoId={s.id}
                      status={s.status}
                      motivo={s.status === "DESISTIU" ? s.motivoDesistiu : s.status === "RECUSOU" ? s.motivoRecusou : null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Conferir tipos, lint e testes**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit -p . && npx eslint "src/app/(admin)/meu-setor" src/lib/actions.ts && npm test`
Expected: sem erros; testes PASS. (O aviso antigo `'atual' is assigned a value but never used` em `actions.ts` já existia e pode ser ignorado.)

- [ ] **Step 9: Commit**

```bash
cd /home/true/quadrante/app
git add src/lib/protecao-paginas.test.ts src/lib/actions.ts "src/app/(admin)/meu-setor" \
  "src/app/(admin)/page.tsx" "src/app/(admin)/cidades/page.tsx" "src/app/(admin)/formacao/page.tsx" \
  "src/app/(admin)/cerco-dashboard/page.tsx" "src/app/(admin)/cerco-dashboard/exportar/route.ts" \
  "src/app/(admin)/registros/page.tsx" "src/app/(admin)/fichas/page.tsx" "src/app/(admin)/fichas/novo/page.tsx" \
  "src/app/(admin)/tribos/page.tsx" "src/app/(admin)/camisetas/page.tsx" \
  "src/app/(admin)/financeiro/page.tsx" "src/app/(admin)/setores/page.tsx" \
  "src/app/(admin)/servos/novo/page.tsx"
git commit -m "feat(coordenador): página /meu-setor, ação marcarStatusServo e checagem em todas as páginas"
```

> Observação: as alterações de hoje (Formação, Financeiro, segurança, backup) já estão commitadas na `main`; este commit contém só o trabalho do coordenador.

---

### Task 5: Criar e editar coordenadores em `/usuarios`

**Files:**
- Modify: `src/lib/actions.ts` (`criarUsuario`, `atualizarUsuario`)
- Modify: `src/app/(admin)/usuarios/CriarUsuarioForm.tsx`
- Modify: `src/app/(admin)/usuarios/[id]/EditarUsuarioForm.tsx`
- Modify: `src/app/(admin)/usuarios/page.tsx`
- Modify: `src/app/(admin)/usuarios/[id]/page.tsx`

**Interfaces:**
- Consumes: `normalizarRole` (Task 1), `Usuario.setor` (Task 2).
- Produces: formulários com o perfil Coordenador e `setor` obrigatório para ele.

- [ ] **Step 1: `criarUsuario`**

Em `src/lib/actions.ts`, adicione `normalizarRole` ao import de `./coordenador` e troque o trecho de `criarUsuario`:

```ts
  const role = normalizarRole(formData.get("role"));
  const setorInformado = String(formData.get("setor") || "").trim();
  const missaoIds = formData.getAll("missaoIds").map(Number).filter((n) => !Number.isNaN(n));

  if (!nome || !email || senha.length < 10) {
    return { error: "Preencha nome, e-mail e uma senha com pelo menos 10 caracteres." };
  }
  if (role !== "SUPER" && missaoIds.length === 0) {
    return { error: "Selecione ao menos uma missão para este usuário." };
  }
  if (role === "COORDENADOR" && !(await db.setor.findUnique({ where: { nome: setorInformado } }))) {
    return { error: "Escolha o setor do coordenador." };
  }
  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) return { error: "Já existe um usuário com esse e-mail." };
  const hash = await bcrypt.hash(senha, 10);
  const usuario = await db.usuario.create({
    data: { nome, email, senha: hash, role, setor: role === "COORDENADOR" ? setorInformado : null },
  });
  if (role !== "SUPER") {
    await db.usuarioMissao.createMany({
      data: missaoIds.map((missaoId) => ({ usuarioId: usuario.id, missaoId })),
    });
  }
```

(mantenha as linhas `const nome`, `const email`, `const senha` e o `revalidatePath`/`return { ok: true }` finais como estão.)

- [ ] **Step 2: `atualizarUsuario`**

No mesmo arquivo, em `atualizarUsuario`, aplique as mesmas trocas:

```ts
  const role = normalizarRole(formData.get("role"));
  const setorInformado = String(formData.get("setor") || "").trim();
```

troque a validação de missão para `if (role !== "SUPER" && missaoIds.length === 0)`, adicione depois dela:

```ts
  if (role === "COORDENADOR" && !(await db.setor.findUnique({ where: { nome: setorInformado } }))) {
    return { error: "Escolha o setor do coordenador." };
  }
```

e, na transação, troque o `data` do `update` e a condição das missões:

```ts
    db.usuario.update({
      where: { id },
      data: {
        nome,
        role,
        setor: role === "COORDENADOR" ? setorInformado : null, // sai de COORDENADOR → setor é limpo
        ...(senhaHash ? { senha: senhaHash, sessaoVersao: { increment: 1 } } : {}),
      },
    }),
    db.usuarioMissao.deleteMany({ where: { usuarioId: id } }),
    ...(role !== "SUPER"
      ? [db.usuarioMissao.createMany({ data: missaoIds.map((missaoId) => ({ usuarioId: id, missaoId })) })]
      : []),
```

- [ ] **Step 3: Formulário de criação**

Em `CriarUsuarioForm.tsx`: receba `setores: string[]`, controle o perfil escolhido e mostre o seletor de setor só para Coordenador.

```tsx
import { useActionState, useRef, useEffect, useState } from "react";
```

```tsx
export default function CriarUsuarioForm({
  missoes,
  setores,
}: {
  missoes: { id: number; nome: string }[];
  setores: string[];
}) {
  const [state, action, pending] = useActionState(criarUsuario, null);
  const [role, setRole] = useState("ADMIN");
```

e troque o `<select name="role">` por:

```tsx
      <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="ADMIN">ADMIN (secretaria)</option>
        <option value="COORDENADOR">COORDENADOR (só o próprio setor)</option>
        <option value="SUPER">SUPER (acesso total)</option>
      </select>
      {role === "COORDENADOR" && (
        <select name="setor" required defaultValue="" className="input col-span-2">
          <option value="" disabled>
            Setor do coordenador…
          </option>
          {setores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
```

- [ ] **Step 4: Formulário de edição**

Em `EditarUsuarioForm.tsx`: acrescente `setor: string | null` ao tipo de `usuario`, a prop `setores: string[]`, `useState` do perfil e o mesmo seletor:

```tsx
import { useActionState, useState } from "react";
```

```tsx
  usuario: { id: number; nome: string; role: string; setor: string | null; missaoIds: number[] };
  missoes: { id: number; nome: string }[];
  setores: string[];
}) {
  const [state, action, pending] = useActionState(atualizarUsuario, null);
  const [role, setRole] = useState(usuario.role);
```

(ajuste a assinatura da função para receber `setores` junto de `usuario` e `missoes`), troque o `<select name="role">`:

```tsx
      <select name="role" className="input col-span-2" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="ADMIN">ADMIN (secretaria)</option>
        <option value="COORDENADOR">COORDENADOR (só o próprio setor)</option>
        <option value="SUPER">SUPER (acesso total)</option>
      </select>
      {role === "COORDENADOR" && (
        <select name="setor" required defaultValue={usuario.setor ?? ""} className="input col-span-2">
          <option value="" disabled>
            Setor do coordenador…
          </option>
          {setores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
```

- [ ] **Step 5: Páginas passam a lista de setores e mostram o setor**

Em `usuarios/page.tsx`, depois do `const missoes = ...`, acrescente:

```tsx
  const setores = (await db.setor.findMany({ orderBy: { nome: "asc" } })).map((s) => s.nome);
```

troque `<CriarUsuarioForm missoes={missoes} />` por `<CriarUsuarioForm missoes={missoes} setores={setores} />` e, na lista, troque a condição `u.role === "ADMIN" && (` por `u.role !== "SUPER" && (`, acrescentando antes da lista de missões, dentro do mesmo `div`:

```tsx
                  {u.role === "COORDENADOR" && <span className="mr-1 font-medium">{u.setor ?? "sem setor"} ·</span>}
```

Em `usuarios/[id]/page.tsx`, depois do `const missoes`, acrescente a mesma linha de `setores`, inclua `setor: usuario.setor,` no objeto `usuario` passado ao formulário e passe `setores={setores}`.

- [ ] **Step 6: Conferir tipos, lint e testes**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit -p . && npx eslint src/lib/actions.ts "src/app/(admin)/usuarios" && npm test`
Expected: sem erros novos; testes PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/true/quadrante/app
git add src/lib/actions.ts "src/app/(admin)/usuarios"
git commit -m "feat(coordenador): criar e editar coordenadores em /usuarios"
```

---

### Task 6: Script de verificação manual

**Files:**
- Create: `scripts/_coordenador-teste.ts`

**Interfaces:**
- Consumes: formato do cookie de sessão de `auth.ts` (`userId.versao.expiraEm.assinatura`, HMAC-SHA256 com `AUTH_SECRET`).
- Produces: `npx tsx --env-file=.env scripts/_coordenador-teste.ts criar <setor> <missaoId>` imprime o valor do cookie; `... remover` apaga o usuário de teste.

- [ ] **Step 1: Criar o script**

```ts
// Uso único de verificação: cria/remove um coordenador de teste e imprime o cookie de sessão.
//   npx tsx --env-file=.env scripts/_coordenador-teste.ts criar "NOME DO SETOR" 98
//   npx tsx --env-file=.env scripts/_coordenador-teste.ts remover
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const EMAIL = "coordenador.teste@quadrante.local";

function cookie(userId: number, versao: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET ausente");
  const expiraEm = Math.floor(Date.now() / 1000) + 3600;
  const payload = `${userId}.${versao}.${expiraEm}`;
  return `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function main() {
  const [cmd, setor, missaoId] = process.argv.slice(2);
  if (cmd === "criar") {
    if (!setor || !missaoId) throw new Error("uso: criar <setor> <missaoId>");
    if (!(await db.setor.findUnique({ where: { nome: setor } }))) throw new Error(`setor inexistente: ${setor}`);
    await db.usuario.deleteMany({ where: { email: EMAIL } });
    const u = await db.usuario.create({
      data: { nome: "Coordenador Teste", email: EMAIL, senha: null, role: "COORDENADOR", setor },
    });
    await db.usuarioMissao.create({ data: { usuarioId: u.id, missaoId: Number(missaoId) } });
    console.log(cookie(u.id, u.sessaoVersao));
  } else if (cmd === "remover") {
    const r = await db.usuario.deleteMany({ where: { email: EMAIL } });
    console.log(`removidos: ${r.count}`);
  } else {
    throw new Error("uso: criar <setor> <missaoId> | remover");
  }
}

main().finally(() => db.$disconnect());
```

- [ ] **Step 2: Commit**

```bash
cd /home/true/quadrante/app
git add scripts/_coordenador-teste.ts
git commit -m "chore(coordenador): script de verificação manual com usuário de teste"
```

---

### Task 7: Verificação ponta a ponta, build e deploy

**Files:** nenhum arquivo novo. Esta task valida e publica.

**Interfaces:** consome tudo das Tasks 1-6.

- [ ] **Step 1: Escolher um setor e uma missão reais**

Run: `cd /home/true/quadrante/app && python3 -c "
import sqlite3
c=sqlite3.connect('file:prisma/quadrante.db?mode=ro',uri=True)
print(c.execute(\"select s.setor, count(*) from Servo s where s.missaoId=95 group by 1 order by 2 desc limit 4\").fetchall())"`
Expected: lista de setores da missão 23 (id 95) com a contagem. Anote um setor **A** (com servos) e um servo de **outro** setor **B** (nome e id).

- [ ] **Step 2: Compilar e subir esta branch no pm2 (porta 3008)**

Não rode `npm run dev` (compartilha o diretório `.next` com a produção). Run: `cd /home/true/quadrante/app && npm run build 2>&1 | grep -E "rror|Failed|Compiled" && pm2 restart quadrante && sleep 4 && curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3008/login`
Expected: `Compiled successfully` e `200`. Todos os `curl` seguintes usam `http://127.0.0.1:3008`, não 3005.

- [ ] **Step 3: Criar o coordenador de teste e guardar o cookie**

Run: `cd /home/true/quadrante/app && TOKEN=$(npx tsx --env-file=.env scripts/_coordenador-teste.ts criar "<SETOR A>" 95) && echo "$TOKEN" | cut -c1-20`
Expected: imprime o início de um token `id.versao.expira...`.

- [ ] **Step 4: Páginas do sistema devem redirecionar para `/meu-setor`**

Run:
```bash
for u in / /servos /financeiro /fichas /formacao /pessoas /tribos /registros /setores /cidades /camisetas /cerco-dashboard /usuarios /missoes /estatisticas "/servos/<ID DO SERVO DO SETOR B>" /servos/novo /cerco-dashboard/exportar /servos/exportar; do
  curl -s -o /dev/null -w "%{http_code} $u -> %{redirect_url}\n" -b "quadrante_session=$TOKEN" "http://127.0.0.1:3008$u"
done
```
Expected: todas as linhas com `307` e destino terminando em `/meu-setor`, ou `/` (que por sua vez cai em `/meu-setor`) para `/usuarios`, `/missoes` e `/estatisticas`. **Nenhuma pode ser `200`.**

- [ ] **Step 5: `/meu-setor` mostra só o setor A**

Run:
```bash
curl -s -b "quadrante_session=$TOKEN" http://127.0.0.1:3008/meu-setor -o /tmp/meu-setor.html -w "%{http_code}\n"
grep -c "<SETOR A>" /tmp/meu-setor.html
grep -c "<NOME DO SERVO DO SETOR B>" /tmp/meu-setor.html
grep -c "Financeiro\|Fichas (Neocampistas)" /tmp/meu-setor.html
```
Expected: `200`; o setor A aparece (≥ 1); o nome do servo do setor B **não** aparece (0); o menu **não** contém Financeiro nem Fichas (0).

- [ ] **Step 6: Perfis atuais continuam funcionando**

No navegador, entre como SUPER (`admin@quadrante.local`) e confira que `/servos`, `/financeiro`, `/formacao` e `/usuarios` abrem normalmente e que o menu completo aparece. Entre como ADMIN, se existir algum, e confira o mesmo para as páginas dele.

- [ ] **Step 7: Marcar status pela interface**

No navegador, entre com o coordenador de teste (use o cookie: DevTools → Application → Cookies → `quadrante_session` = valor de `$TOKEN`). Em `/meu-setor`:
1. Clique **Não** num servo, escreva um motivo e confirme: o botão fica destacado e o motivo aparece embaixo.
2. Clique **Desistiu**, escreva outro motivo e confirme: o motivo antigo some e o novo aparece.
3. Clique **Sim**: o motivo some.
4. Em `/registros` (como SUPER), confirme que o servo aparece e some conforme os cliques.

- [ ] **Step 8: Nada fora do setor mudou**

A recusa de servo de outro setor está coberta por `podeMarcarServo` (Task 1). Aqui confirme só no banco que os outros setores continuam iguais:

Run: `cd /home/true/quadrante/app && python3 -c "
import sqlite3
c=sqlite3.connect('file:prisma/quadrante.db?mode=ro',uri=True)
print(c.execute(\"select setor,status,count(*) from Servo where missaoId=95 group by 1,2 order by 1\").fetchall())"`
Expected: só o servo que você clicou, no setor A, mudou de status; os demais setores estão idênticos ao início.

- [ ] **Step 9: Limpar o usuário de teste e parar o dev**

Run: `cd /home/true/quadrante/app && npx tsx --env-file=.env scripts/_coordenador-teste.ts remover`
Expected: `removidos: 1`. **Devolva o servo que você alterou ao status original** (use "Sim" no passo 7.3, ou ajuste em `/servos`).

- [ ] **Step 10: Build e deploy**

Run: `cd /home/true/quadrante/app && npm run build 2>&1 | grep -E "rror|Failed|Compiled" ; pm2 restart quadrante && pm2 save`
Expected: `Compiled successfully`; processo `online`.

Run: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3008/login; tail -3 /root/.pm2/logs/quadrante-error.log`
Expected: `200`; log de erros sem entradas novas.

- [ ] **Step 11: Registrar o uso**

Anote para o usuário: para criar um coordenador, `/usuarios` → "Novo usuário" → perfil COORDENADOR → setor e missão. Se um setor for renomeado em `/setores`, reatribua o setor do coordenador em `/usuarios/<id>`. Se for útil, acrescente uma linha ao README na seção "Módulos do sistema" e faça commit só do README.

---

## Self-Review

**Cobertura do spec**
- Dados (`role`, `setor`, migração com backup): Task 2.
- Autorização (`requireUser`, `getMissaoAtiva`, `requireCoordenador`, layout/menu): Task 3.
- 13 páginas e rotas protegidas: Task 4, com a varredura como teste.
- Tela `/meu-setor`: Task 4, passos 6 e 7.
- Ação `marcarStatusServo` (setor, missão, status válido, só os campos de status, revalidação): Task 4, passo 5, e regras na Task 1.
- Criação do acesso em `/usuarios`: Task 5. Troca de perfil limpa o setor, setor validado contra `Setor`.
- Testes automatizados e verificação manual: Tasks 1, 4, 6 e 7.
- Risco do login com Google: `callback/route.ts` só promove a SUPER e nunca troca o perfil de um existente; não há mudança. O coordenador que também é administrador do Workspace vira SUPER ao entrar com Google, o que é o comportamento atual para qualquer admin do Workspace.

**Placeholders:** os marcadores `<SETOR A>`, `<NOME DO SERVO DO SETOR B>` e `<ID DO SERVO DO SETOR B>` da Task 7 são valores que o executor lê da consulta do passo 1; não são lacunas do plano.

**Consistência de tipos:** `statusValido`, `podeMarcarServo`, `dadosDoStatus` e `normalizarRole` têm as mesmas assinaturas na Task 1 e nos usos das Tasks 4 e 5. `requireCoordenador` devolve `{ usuario, setor, missao, missaoIds }` na Task 3 e é desestruturado assim em `marcarStatusServo` (`setor`, `missaoIds`) e em `MeuSetorPage` (`setor`, `missao`).
