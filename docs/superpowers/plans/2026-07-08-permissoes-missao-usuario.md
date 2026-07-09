# Permissões de Missão por Usuário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um SUPER vincule cada usuário ADMIN a uma ou mais missões específicas (no cadastro e na edição), e que o sistema restrinja a visualização/edição desse ADMIN às missões vinculadas, em vez de travá-lo sempre na missão mais recente.

**Architecture:** Nova tabela de junção `UsuarioMissao` (many-to-many entre `Usuario` e `Missao`). `getMissaoAtiva` (em `src/lib/auth.ts`) passa a consultar essa tabela para ADMIN, em vez de sempre pegar a missão de maior id. O formulário de criar usuário ganha checkboxes de missão; um novo formulário de editar usuário permite ajustar isso depois. O `AdminLayout` ganha seletor de missão para ADMIN com mais de uma missão vinculada, reaproveitando o padrão já usado para SUPER.

**Tech Stack:** Next.js (App Router, Server Actions), Prisma + SQLite, TypeScript. Sem framework de testes no projeto — verificação é feita via `npx tsc --noEmit`, `prisma migrate dev`, e checagem manual dos fluxos (consistente com o resto do projeto, que não tem suíte de testes).

## Global Constraints

- SUPER nunca é afetado: continua com acesso a todas as missões, sem vínculo em `UsuarioMissao`.
- Um ADMIN sem missão vinculada (usuário mal cadastrado) não deve quebrar a aplicação — `getMissaoAtiva` retorna `null` e páginas que dependem de missão devem lidar com isso sem lançar exceção.
- Migração de dados: todo `Usuario` com `role = "ADMIN"` já existente recebe vínculo com a missão de maior `id` (a que ele já enxergava antes da mudança).
- Dentro de uma missão vinculada, ADMIN mantém acesso total (visualizar + editar), igual a hoje — não há granularidade "só visualizar".
- Seguir os padrões existentes do projeto: server actions em `src/lib/actions.ts` com `"use server"` no topo do arquivo, proteção via `requireRole("SUPER")`, `revalidatePath` após mutações, classes Tailwind (`card`, `input`, `btn-primary`, `btn-danger-link`) já usadas nas outras telas.

---

### Task 1: Schema — tabela `UsuarioMissao` e migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create (auto-gerado por `prisma migrate dev`): `prisma/migrations/<timestamp>_usuario_missao/migration.sql`

**Interfaces:**
- Produces: modelo Prisma `UsuarioMissao { usuarioId: number; missaoId: number }`, acessível via `db.usuarioMissao` no client gerado; `Usuario.missoes: UsuarioMissao[]`; `Missao.usuarios: UsuarioMissao[]`.

- [ ] **Step 1: Editar o schema**

Em `prisma/schema.prisma`, altere o model `Usuario` para incluir a relação reversa:

```prisma
model Usuario {
  id    Int    @id @default(autoincrement())
  nome  String
  email String @unique
  senha String // hash bcrypt
  role  String @default("ADMIN") // SUPER | ADMIN

  missoes UsuarioMissao[]
}
```

Altere o model `Missao` para incluir a relação reversa (adicione a linha `usuarios` junto das outras relações existentes):

```prisma
model Missao {
  id            Int    @id @default(autoincrement())
  nome          String
  tipo          String // MIRIM | FAC | JUVENIL | SENIOR | CASAIS
  ano           Int
  cercoSlug     String @unique
  valorInterna  Float  @default(160)
  valorExterna  Float  @default(80)
  valorCampista Float  @default(300)

  servos       Servo[]
  neocampistas Neocampista[]
  tribos       Tribo[]
  usuarios     UsuarioMissao[]
}
```

Adicione o novo model logo depois de `Missao`:

```prisma
// vínculo de acesso: quais missões um usuário ADMIN pode ver/editar (SUPER não usa isso)
model UsuarioMissao {
  usuarioId Int
  missaoId  Int

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  missao  Missao  @relation(fields: [missaoId], references: [id], onDelete: Cascade)

  @@id([usuarioId, missaoId])
}
```

- [ ] **Step 2: Gerar e aplicar a migração**

Run: `cd /home/true/quadrante/app && npx prisma migrate dev --name usuario_missao`
Expected: saída terminando em `Your database is now in sync with your schema.` e um novo diretório `prisma/migrations/<timestamp>_usuario_missao/` criado.

- [ ] **Step 3: Verificar que o client foi regenerado**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit`
Expected: sem erros novos relacionados a `usuarioMissao`, `UsuarioMissao` (o Prisma Client é regenerado automaticamente pelo `migrate dev`).

- [ ] **Step 4: Commit**

```bash
cd /home/true/quadrante/app
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: adiciona UsuarioMissao para permissões de missão por usuário"
```

---

### Task 2: Script de backfill para ADMINs existentes

**Files:**
- Create: `scripts/backfill-usuario-missao.ts`

**Interfaces:**
- Consumes: `db` de `src/lib/db.ts` (`PrismaClient`), models `Usuario` e `Missao` do Task 1.
- Produces: registros em `UsuarioMissao` para todo `Usuario` com `role === "ADMIN"` que ainda não tenha nenhum vínculo, apontando para a missão de maior `id`.

- [ ] **Step 1: Escrever o script**

```typescript
// Script de uso único: vincula todo ADMIN existente à missão mais recente,
// preservando o acesso que ele já tinha antes de existir UsuarioMissao.
// Rodar uma vez após aplicar a migração usuario_missao: npx tsx scripts/backfill-usuario-missao.ts
import { db } from "../src/lib/db";

async function main() {
  const missaoRecente = await db.missao.findFirst({ orderBy: { id: "desc" } });
  if (!missaoRecente) {
    console.log("Nenhuma missão cadastrada, nada a fazer.");
    return;
  }

  const admins = await db.usuario.findMany({
    where: { role: "ADMIN" },
    include: { missoes: true },
  });

  for (const admin of admins) {
    if (admin.missoes.length > 0) continue;
    await db.usuarioMissao.create({
      data: { usuarioId: admin.id, missaoId: missaoRecente.id },
    });
    console.log(`Vinculado: ${admin.nome} -> missão ${missaoRecente.nome} (id ${missaoRecente.id})`);
  }

  console.log("Backfill concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
```

- [ ] **Step 2: Rodar o script contra o banco de desenvolvimento**

Run: `cd /home/true/quadrante/app && npx tsx scripts/backfill-usuario-missao.ts`
Expected: uma linha `Vinculado: <nome> -> missão ...` para cada ADMIN existente, terminando em `Backfill concluído.`.

- [ ] **Step 3: Conferir no banco**

Run: `cd /home/true/quadrante/app && npx prisma studio` (abrir a tabela `UsuarioMissao` e checar visualmente), ou:
Run: `cd /home/true/quadrante/app && sqlite3 prisma/dev.db "select * from UsuarioMissao;"` (ajuste o caminho do banco conforme `DATABASE_URL` em `.env`)
Expected: uma linha por ADMIN existente, todas apontando para o mesmo `missaoId` (o de maior valor).

- [ ] **Step 4: Commit**

```bash
cd /home/true/quadrante/app
git add scripts/backfill-usuario-missao.ts
git commit -m "chore: script de backfill de UsuarioMissao para admins existentes"
```

---

### Task 3: `getMissaoAtiva` restrito por vínculo, para ADMIN

**Files:**
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Consumes: `db.usuarioMissao`, `db.missao`, `db.usuario` (Task 1).
- Produces: `getMissoesPermitidas(userId: number): Promise<Missao[]>` (nova função exportada, retorna as missões vinculadas ao usuário, ordenadas por `id desc`); `getMissaoAtiva()` com o novo comportamento para ADMIN, mesma assinatura de hoje (`Promise<Missao | null>`).

- [ ] **Step 1: Adicionar `getMissoesPermitidas` e ajustar `getMissaoAtiva`**

Substitua a função `getMissaoAtiva` inteira em `src/lib/auth.ts` (a que começa em `// missão ativa selecionada (cookie)...`) por:

```typescript
// missão ativa selecionada (cookie) — ADMIN só enxerga as missões vinculadas a ele
const MISSAO_COOKIE = "quadrante_missao";

export async function setMissaoAtiva(id: number) {
  const store = await cookies();
  store.set(MISSAO_COOKIE, String(id), { maxAge: 60 * 60 * 24 * 365 });
}

// missões que o usuário pode ver/editar. SUPER não é consultado aqui (sempre vê tudo).
export async function getMissoesPermitidas(userId: number) {
  const vinculos = await db.usuarioMissao.findMany({
    where: { usuarioId: userId },
    include: { missao: true },
    orderBy: { missao: { id: "desc" } },
  });
  return vinculos.map((v) => v.missao);
}

export async function getMissaoAtiva() {
  const userId = await getSessionUserId();
  const user = userId ? await db.usuario.findUnique({ where: { id: userId } }) : null;
  if (!user) return null;

  const store = await cookies();
  const raw = store.get(MISSAO_COOKIE)?.value;

  if (user.role !== "SUPER") {
    // ADMIN: só pode ver as missões vinculadas a ele
    const permitidas = await getMissoesPermitidas(user.id);
    if (permitidas.length === 0) return null;
    if (raw) {
      const escolhida = permitidas.find((m) => m.id === Number(raw));
      if (escolhida) return escolhida;
    }
    return permitidas[0]; // já vem ordenado por id desc = mais recente primeiro
  }

  // SUPER: continua respeitando o cookie entre todas as missões
  if (raw) {
    const m = await db.missao.findUnique({ where: { id: Number(raw) } });
    if (m) return m;
  }
  return db.missao.findFirst({ orderBy: { id: "desc" } });
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação manual do fluxo de login como ADMIN**

Com o backfill do Task 2 já aplicado, faça login como um usuário ADMIN existente (`npm run dev`, acessar `/login`) e confirme que a missão exibida no layout é a mesma de antes da mudança (a mais recente). Isso confirma que a migração + a nova lógica preservam o comportamento atual.

- [ ] **Step 4: Commit**

```bash
cd /home/true/quadrante/app
git add src/lib/auth.ts
git commit -m "feat: getMissaoAtiva restringe ADMIN às missões vinculadas"
```

---

### Task 4: Componente de checkboxes de missão (compartilhado)

**Files:**
- Create: `src/app/(admin)/usuarios/MissaoCheckboxes.tsx`

**Interfaces:**
- Consumes: nada além de props.
- Produces: componente `MissaoCheckboxes({ missoes, selecionadas }: { missoes: { id: number; nome: string }[]; selecionadas: number[] }) => JSX.Element`, renderiza checkboxes `name="missaoIds"` (um `formData.getAll("missaoIds")` no server action captura todos os marcados).

- [ ] **Step 1: Criar o componente**

```tsx
export default function MissaoCheckboxes({
  missoes,
  selecionadas,
}: {
  missoes: { id: number; nome: string }[];
  selecionadas: number[];
}) {
  return (
    <fieldset className="col-span-2 border border-[var(--line)] rounded p-3">
      <legend className="text-sm font-medium px-1">Missões que este usuário pode ver e editar</legend>
      <div className="grid grid-cols-2 gap-1 mt-1 max-h-48 overflow-y-auto">
        {missoes.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm py-0.5">
            <input
              type="checkbox"
              name="missaoIds"
              value={m.id}
              defaultChecked={selecionadas.includes(m.id)}
            />
            {m.nome}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
cd /home/true/quadrante/app
git add "src/app/(admin)/usuarios/MissaoCheckboxes.tsx"
git commit -m "feat: componente de checkboxes de missão para cadastro/edição de usuário"
```

---

### Task 5: `criarUsuario` grava as missões vinculadas + formulário atualizado

**Files:**
- Modify: `src/lib/actions.ts:684-699` (função `criarUsuario`)
- Modify: `src/app/(admin)/usuarios/CriarUsuarioForm.tsx`
- Modify: `src/app/(admin)/usuarios/page.tsx`

**Interfaces:**
- Consumes: `MissaoCheckboxes` (Task 4), `db.missao`, `db.usuarioMissao` (Task 1).
- Produces: `criarUsuario` continua com a mesma assinatura de server action (`(_prev: unknown, formData: FormData) => Promise<{ error: string } | { ok: true }>`), agora também validando e persistindo `missaoIds` quando `role === "ADMIN"`.

- [ ] **Step 1: Atualizar `criarUsuario` em `src/lib/actions.ts`**

Substitua a função (linhas 684-699) por:

```typescript
export async function criarUsuario(_prev: unknown, formData: FormData) {
  await requireRole("SUPER");
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const role = String(formData.get("role") || "ADMIN") === "SUPER" ? "SUPER" : "ADMIN";
  const missaoIds = formData.getAll("missaoIds").map(Number).filter((n) => !Number.isNaN(n));

  if (!nome || !email || senha.length < 4) {
    return { error: "Preencha nome, e-mail e uma senha com pelo menos 4 caracteres." };
  }
  if (role === "ADMIN" && missaoIds.length === 0) {
    return { error: "Selecione ao menos uma missão para este usuário." };
  }
  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) return { error: "Já existe um usuário com esse e-mail." };
  const hash = await bcrypt.hash(senha, 10);
  const usuario = await db.usuario.create({ data: { nome, email, senha: hash, role } });
  if (role === "ADMIN") {
    await db.usuarioMissao.createMany({
      data: missaoIds.map((missaoId) => ({ usuarioId: usuario.id, missaoId })),
    });
  }
  revalidatePath("/usuarios");
  return { ok: true };
}
```

- [ ] **Step 2: Atualizar `CriarUsuarioForm.tsx` para buscar missões e renderizar o checkbox**

Como este é um Client Component (`"use client"`) e precisa dos dados de missões vindos do servidor, transforme-o para receber `missoes` via props e deixe a página (`page.tsx`) buscar os dados. Novo conteúdo de `src/app/(admin)/usuarios/CriarUsuarioForm.tsx`:

```tsx
"use client";

import { useActionState, useRef, useEffect } from "react";
import { criarUsuario } from "@/lib/actions";
import MissaoCheckboxes from "./MissaoCheckboxes";

export default function CriarUsuarioForm({ missoes }: { missoes: { id: number; nome: string }[] }) {
  const [state, action, pending] = useActionState(criarUsuario, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card p-4 grid grid-cols-2 gap-3">
      <input name="nome" required placeholder="Nome" className="input col-span-2" />
      <input name="email" type="email" required placeholder="E-mail" className="input col-span-2" />
      <input name="senha" type="password" required placeholder="Senha" className="input" />
      <select name="role" className="input" defaultValue="ADMIN">
        <option value="ADMIN">ADMIN (secretaria)</option>
        <option value="SUPER">SUPER (acesso total)</option>
      </select>
      <MissaoCheckboxes missoes={missoes} selecionadas={[]} />
      {state && "error" in state && state.error && (
        <p className="col-span-2 text-[var(--signal)] text-sm">{state.error}</p>
      )}
      <button disabled={pending} className="btn-primary px-4 py-2 col-span-2">
        {pending ? "Criando..." : "Criar usuário"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Atualizar `usuarios/page.tsx` para buscar e passar as missões, e listar os vínculos de cada usuário**

Substitua o conteúdo de `src/app/(admin)/usuarios/page.tsx` por:

```tsx
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { excluirUsuario } from "@/lib/actions";
import CriarUsuarioForm from "./CriarUsuarioForm";

export default async function UsuariosPage() {
  const atual = await requireRole("SUPER");
  const usuarios = await db.usuario.findMany({
    orderBy: { nome: "asc" },
    include: { missoes: { include: { missao: true } } },
  });
  const missoes = await db.missao.findMany({ orderBy: { id: "desc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Usuários</h1>

      <div className="card divide-y divide-[var(--line)] mb-8">
        {usuarios.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {u.nome}
                <span className="ml-2 text-[0.65rem] font-[var(--font-plex-mono)] text-[var(--brass)] border border-[var(--brass)]/40 rounded px-1 py-px align-middle">
                  {u.role}
                </span>
              </div>
              <div className="text-sm text-[var(--ink-soft)]/60">{u.email}</div>
              {u.role === "ADMIN" && (
                <div className="text-xs text-[var(--ink-soft)]/60 mt-0.5">
                  {u.missoes.length > 0
                    ? u.missoes.map((v) => v.missao.nome).join(", ")
                    : "nenhuma missão vinculada"}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <a href={`/usuarios/${u.id}`} className="text-sm underline text-[var(--brass)]">
                Editar
              </a>
              {u.id !== atual.id && (
                <form action={excluirUsuario}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="btn-danger-link">Excluir</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-bold mb-3">Novo usuário</h2>
      <CriarUsuarioForm missoes={missoes} />
    </div>
  );
}
```

- [ ] **Step 4: Checar tipos**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit`
Expected: sem erros (o link `/usuarios/${u.id}` ainda não existe como rota — isso é normal, será criado no Task 6; não gera erro de TypeScript porque é uma string, não uma rota tipada aqui).

- [ ] **Step 5: Verificação manual**

Com `npm run dev` rodando, acessar `/usuarios` logado como SUPER, criar um usuário ADMIN sem marcar nenhuma missão e confirmar que aparece o erro "Selecione ao menos uma missão para este usuário.". Marcar uma missão e confirmar que o usuário é criado e a lista de missões vinculadas aparece abaixo do nome dele.

- [ ] **Step 6: Commit**

```bash
cd /home/true/quadrante/app
git add src/lib/actions.ts "src/app/(admin)/usuarios/CriarUsuarioForm.tsx" "src/app/(admin)/usuarios/page.tsx"
git commit -m "feat: cadastro de usuário grava missões vinculadas"
```

---

### Task 6: Edição de usuário (`atualizarUsuario` + página `/usuarios/[id]`)

**Files:**
- Modify: `src/lib/actions.ts` (nova função `atualizarUsuario`, próxima a `criarUsuario`)
- Create: `src/app/(admin)/usuarios/[id]/page.tsx`
- Create: `src/app/(admin)/usuarios/[id]/EditarUsuarioForm.tsx`

**Interfaces:**
- Consumes: `MissaoCheckboxes` (Task 4), `db.usuario`, `db.usuarioMissao`, `db.missao`.
- Produces: server action `atualizarUsuario(_prev: unknown, formData: FormData): Promise<{ error: string } | { ok: true }>`, espera campos `id`, `nome`, `role`, `missaoIds[]` no `formData`.

- [ ] **Step 1: Adicionar `atualizarUsuario` em `src/lib/actions.ts`**

Adicione logo após a função `criarUsuario`:

```typescript
export async function atualizarUsuario(_prev: unknown, formData: FormData) {
  await requireRole("SUPER");
  const id = Number(formData.get("id"));
  const nome = String(formData.get("nome") || "").trim();
  const role = String(formData.get("role") || "ADMIN") === "SUPER" ? "SUPER" : "ADMIN";
  const missaoIds = formData.getAll("missaoIds").map(Number).filter((n) => !Number.isNaN(n));

  if (!id || !nome) return { error: "Preencha o nome." };
  if (role === "ADMIN" && missaoIds.length === 0) {
    return { error: "Selecione ao menos uma missão para este usuário." };
  }

  await db.$transaction([
    db.usuario.update({ where: { id }, data: { nome, role } }),
    db.usuarioMissao.deleteMany({ where: { usuarioId: id } }),
    ...(role === "ADMIN"
      ? [
          db.usuarioMissao.createMany({
            data: missaoIds.map((missaoId) => ({ usuarioId: id, missaoId })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/usuarios");
  return { ok: true };
}
```

- [ ] **Step 2: Criar `EditarUsuarioForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { atualizarUsuario } from "@/lib/actions";
import MissaoCheckboxes from "../MissaoCheckboxes";

export default function EditarUsuarioForm({
  usuario,
  missoes,
}: {
  usuario: { id: number; nome: string; role: string; missaoIds: number[] };
  missoes: { id: number; nome: string }[];
}) {
  const [state, action, pending] = useActionState(atualizarUsuario, null);

  return (
    <form action={action} className="card p-4 grid grid-cols-2 gap-3">
      <input type="hidden" name="id" value={usuario.id} />
      <input name="nome" required defaultValue={usuario.nome} placeholder="Nome" className="input col-span-2" />
      <select name="role" className="input col-span-2" defaultValue={usuario.role}>
        <option value="ADMIN">ADMIN (secretaria)</option>
        <option value="SUPER">SUPER (acesso total)</option>
      </select>
      <MissaoCheckboxes missoes={missoes} selecionadas={usuario.missaoIds} />
      {state && "error" in state && state.error && (
        <p className="col-span-2 text-[var(--signal)] text-sm">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="col-span-2 text-sm text-[var(--ink-soft)]/70">Salvo.</p>
      )}
      <button disabled={pending} className="btn-primary px-4 py-2 col-span-2">
        {pending ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Criar a página `src/app/(admin)/usuarios/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import EditarUsuarioForm from "./EditarUsuarioForm";

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER");
  const { id } = await params;
  const usuario = await db.usuario.findUnique({
    where: { id: Number(id) },
    include: { missoes: true },
  });
  if (!usuario) notFound();
  const missoes = await db.missao.findMany({ orderBy: { id: "desc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Editar usuário</h1>
      <EditarUsuarioForm
        usuario={{
          id: usuario.id,
          nome: usuario.nome,
          role: usuario.role,
          missaoIds: usuario.missoes.map((v) => v.missaoId),
        }}
        missoes={missoes}
      />
    </div>
  );
}
```

- [ ] **Step 4: Checar tipos**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Com `npm run dev` rodando, logado como SUPER, ir em `/usuarios`, clicar "Editar" num ADMIN, desmarcar todas as missões e tentar salvar (esperar erro), marcar uma missão diferente da atual e salvar (esperar "Salvo." e a lista de missões do usuário atualizada na página `/usuarios`).

- [ ] **Step 6: Commit**

```bash
cd /home/true/quadrante/app
git add src/lib/actions.ts "src/app/(admin)/usuarios/[id]"
git commit -m "feat: edição de usuário permite ajustar missões vinculadas"
```

---

### Task 7: Seletor de missão no `AdminLayout` para ADMIN com múltiplas missões

**Files:**
- Modify: `src/app/(admin)/layout.tsx`

**Interfaces:**
- Consumes: `getMissoesPermitidas` (Task 3), `getMissaoAtiva` (Task 3), `selecionarMissao` (existente em `src/lib/actions.ts`, hoje protegido por `requireRole("SUPER")`).
- Produces: nenhuma nova interface pública — só muda o JSX renderizado.

- [ ] **Step 1: Permitir que `selecionarMissao` seja usado por ADMIN também**

Em `src/lib/actions.ts`, a função `selecionarMissao` (linhas 46-50) hoje chama `requireRole("SUPER")`. Troque para `requireUser()`, já que agora ADMIN também pode trocar entre as missões que tem vinculadas:

```typescript
export async function selecionarMissao(formData: FormData) {
  await requireUser();
  await setMissaoAtiva(Number(formData.get("id")));
  revalidatePath("/");
}
```

- [ ] **Step 2: Atualizar `AdminLayout` para buscar as missões corretas por role**

Em `src/app/(admin)/layout.tsx`, substitua:

```tsx
import { requireUser, getMissaoAtiva } from "@/lib/auth";
```
por
```tsx
import { requireUser, getMissaoAtiva, getMissoesPermitidas } from "@/lib/auth";
```

Substitua o bloco:

```tsx
  const isSuper = user.role === "SUPER";
  const missoes = isSuper ? await db.missao.findMany({ orderBy: { id: "desc" } }) : [];
  const nav = NAV.filter(([, , superOnly]) => !superOnly || isSuper);
```

por:

```tsx
  const isSuper = user.role === "SUPER";
  const missoes = isSuper
    ? await db.missao.findMany({ orderBy: { id: "desc" } })
    : await getMissoesPermitidas(user.id);
  const mostrarSeletor = missoes.length > 1;
  const nav = NAV.filter(([, , superOnly]) => !superOnly || isSuper);
```

E substitua as duas condições que hoje usam `isSuper` para exibir o seletor / o texto simples:

```tsx
          {missao && isSuper && (
```
por
```tsx
          {missao && mostrarSeletor && (
```

e

```tsx
          {missao && !isSuper && (
```
por
```tsx
          {missao && !mostrarSeletor && (
```

- [ ] **Step 3: Checar tipos**

Run: `cd /home/true/quadrante/app && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificação manual**

1. Editar um ADMIN existente (via `/usuarios/[id]`) para vincular a duas missões diferentes. Logar como esse ADMIN e confirmar que o seletor de missão aparece no menu lateral, com as duas opções, e que trocar a seleção realmente muda os dados exibidos nas telas (ex: `/servos`).
2. Editar esse mesmo ADMIN de volta para apenas uma missão e confirmar que o seletor desaparece, voltando ao texto simples com o nome da missão.
3. Logar como SUPER e confirmar que o seletor continua mostrando todas as missões, sem qualquer restrição.

- [ ] **Step 5: Commit**

```bash
cd /home/true/quadrante/app
git add src/lib/actions.ts "src/app/(admin)/layout.tsx"
git commit -m "feat: seletor de missão no layout para ADMIN com múltiplas missões vinculadas"
```

---

## Final Verification

- [ ] Rodar `cd /home/true/quadrante/app && npx tsc --noEmit && npm run lint` e confirmar que ambos passam sem erros.
- [ ] Rodar `cd /home/true/quadrante/app && npm run build` e confirmar que o build completa sem erros.
- [ ] Repassar o fluxo completo manualmente: criar um novo ADMIN com uma missão, confirmar que ele só vê essa missão; editar para adicionar uma segunda missão, confirmar que o seletor aparece e funciona; criar um SUPER e confirmar que ele continua vendo todas as missões sem seletor de checkboxes na criação interferir nisso.
