# Recolher setores no Quadrante + ocultar horários lotados no Cerco Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins collapse/expand each setor card on `/servos` (state remembered per missão via localStorage), and hide full time slots from the public Cerco de Jericó signup page.

**Architecture:** Two independent, unrelated UI changes in a Next.js App Router project with no test framework configured. Verification is manual (dev server + browser), not automated tests. Change 1 extracts the existing setor-card JSX from `src/app/(admin)/servos/page.tsx` into a new client component `SetorCard.tsx` that owns open/closed state and localStorage sync. Change 2 moves `MAX_POR_HORARIO` into `src/lib/constants.ts`, filters full slots server-side in `src/app/cerco/[slug]/page.tsx`, and simplifies `CercoForm.tsx` to receive only the available slots.

**Tech Stack:** Next.js (App Router, Server Components), React (client components with `"use client"`), Prisma, TypeScript, Tailwind-style CSS variables (no test runner — this project has none; `npm run lint` and `npm run build` are the available verification commands).

## Global Constraints

- No automated test framework exists in this repo (confirmed: no jest/vitest, no `*.test.ts*` files, `package.json` scripts are only `dev`, `build`, `start`, `lint`). Do not add one — verify manually with `npm run lint`, `npm run build`, and by running `npm run dev` and checking the page in a browser.
- The admin servo form (`src/app/(admin)/servos/ServoForm.tsx`) and `src/app/(admin)/cerco-dashboard/page.tsx` must keep showing **all** 24 `HORARIOS_CERCO` slots, unfiltered — the "hide when full" behavior applies ONLY to `src/app/cerco/[slug]/page.tsx` (the public signup page).
- Follow existing code style: no comments unless explaining non-obvious *why*, 2-space indent, double quotes, existing CSS variable classes (`card`, `input`, `btn-primary`, `[var(--ink)]`, etc.) — match what's already in the files you touch.
- Don't touch unrelated code in the files you edit.

---

### Task 1: Move `MAX_POR_HORARIO` into shared constants

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/app/cerco/[slug]/CercoForm.tsx:1-7`

**Interfaces:**
- Produces: `MAX_POR_HORARIO: number` exported from `@/lib/constants`, value `15`. Later tasks (2, 3) import this from `@/lib/constants` instead of a local file-level constant.

- [ ] **Step 1: Add the constant to `src/lib/constants.ts`**

Append to the end of `src/lib/constants.ts` (after the `CORES_TRIBO` array):

```ts

export const MAX_POR_HORARIO = 15;
```

- [ ] **Step 2: Remove the local constant from `CercoForm.tsx` and import the shared one**

In `src/app/cerco/[slug]/CercoForm.tsx`, the current top of the file is:

```tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { inscreverCerco, sugerirNomesCerco } from "@/lib/actions";
import { HORARIOS_CERCO } from "@/lib/constants";

const MAX_POR_HORARIO = 15;
```

Replace it with:

```tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { inscreverCerco, sugerirNomesCerco } from "@/lib/actions";
import { MAX_POR_HORARIO } from "@/lib/constants";
```

(Note: `HORARIOS_CERCO` is dropped from this import — Task 3 replaces the form's use of `HORARIOS_CERCO` with a `horarios` prop, so after Task 3 the import is no longer needed here. If you run `npm run lint` right after this step and before Task 3, you'll see an "unused import" style situation resolve itself — that's expected, don't fix it out of order.)

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds (this step only moved a constant; `CercoForm.tsx` still references `HORARIOS_CERCO` elsewhere in the file until Task 3, so it must still be imported — see note below).

Actually, since `CercoForm.tsx` still uses `HORARIOS_CERCO.map(...)` later in the file (until Task 3 changes it), keep `HORARIOS_CERCO` in the import for now. Correct the import line from Step 2 to:

```tsx
import { HORARIOS_CERCO, MAX_POR_HORARIO } from "@/lib/constants";
```

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/app/cerco/\[slug\]/CercoForm.tsx
git commit -m "refactor: move MAX_POR_HORARIO into shared constants"
```

---

### Task 2: Filter full horários server-side on the public Cerco page

**Files:**
- Modify: `src/app/cerco/[slug]/page.tsx`

**Interfaces:**
- Consumes: `MAX_POR_HORARIO` from `@/lib/constants` (Task 1). `HORARIOS_CERCO` from `@/lib/constants` (already imported implicitly via existing code — actually not yet imported in this file; add it).
- Produces: `horariosDisponiveis: string[]` passed as new prop `horarios` to `<CercoForm>`. Task 3 defines `CercoForm`'s `horarios` prop to match this exact name and type.

- [ ] **Step 1: Import `HORARIOS_CERCO` and `MAX_POR_HORARIO`, compute available slots**

Current file `src/app/cerco/[slug]/page.tsx`:

```tsx
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import CercoForm from "./CercoForm";

export default async function CercoPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const missao = await db.missao.findUnique({ where: { cercoSlug: slug } });
  if (!missao) notFound();

  const setores = await db.setor.findMany({ orderBy: { nome: "asc" } });

  const ocupacao = await db.servo.groupBy({
    by: ["cercoHorario"],
    where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } },
    _count: true,
  });
  const ocupados = new Map(ocupacao.map((o) => [o.cercoHorario, o._count]));

  return (
    <main className="min-h-screen bg-[var(--ink)] p-4 md:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--brass-bright)] mb-2">
            {missao.nome}
          </p>
          <h1 className="font-[var(--font-spectral)] text-4xl text-[var(--paper)]">Cerco de Jericó</h1>
          <p className="text-sm text-[var(--paper)]/70 mt-3 max-w-md mx-auto">
            Vigília de oração de 24 horas diante do Santíssimo Sacramento. Preencha seu nome, escolha
            seu setor e reserve 1 hora de adoração.
          </p>
        </div>

        <CercoForm
          missaoId={missao.id}
          setores={setores.map((s) => s.nome)}
          ocupados={Object.fromEntries(ocupados)}
        />
      </div>
    </main>
  );
}
```

Replace the whole file with:

```tsx
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { HORARIOS_CERCO, MAX_POR_HORARIO } from "@/lib/constants";
import CercoForm from "./CercoForm";

export default async function CercoPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const missao = await db.missao.findUnique({ where: { cercoSlug: slug } });
  if (!missao) notFound();

  const setores = await db.setor.findMany({ orderBy: { nome: "asc" } });

  const ocupacao = await db.servo.groupBy({
    by: ["cercoHorario"],
    where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } },
    _count: true,
  });
  const ocupados = new Map(ocupacao.map((o) => [o.cercoHorario, o._count]));
  const horariosDisponiveis = HORARIOS_CERCO.filter((h) => (ocupados.get(h) || 0) < MAX_POR_HORARIO);

  return (
    <main className="min-h-screen bg-[var(--ink)] p-4 md:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--brass-bright)] mb-2">
            {missao.nome}
          </p>
          <h1 className="font-[var(--font-spectral)] text-4xl text-[var(--paper)]">Cerco de Jericó</h1>
          <p className="text-sm text-[var(--paper)]/70 mt-3 max-w-md mx-auto">
            Vigília de oração de 24 horas diante do Santíssimo Sacramento. Preencha seu nome, escolha
            seu setor e reserve 1 hora de adoração.
          </p>
        </div>

        <CercoForm
          missaoId={missao.id}
          setores={setores.map((s) => s.nome)}
          horarios={horariosDisponiveis}
          ocupados={Object.fromEntries(ocupados)}
        />
      </div>
    </main>
  );
}
```

(Note: `ocupados` was a `Map`, and `Object.fromEntries(ocupados)` already worked on the Map directly in the original code — that's unchanged. The only additions are the `HORARIOS_CERCO`/`MAX_POR_HORARIO` import and the `horariosDisponiveis` filter, plus passing `horarios={horariosDisponiveis}`.)

- [ ] **Step 2: Verify build (will fail until Task 3, that's expected)**

Run: `npm run build`
Expected: TypeScript error in `CercoForm.tsx` — `Property 'horarios' does not exist` or similar, because `CercoForm`'s props type doesn't have `horarios` yet. This confirms the page correctly demands the new prop. Proceed to Task 3 before the next successful build.

- [ ] **Step 3: Commit**

```bash
git add src/app/cerco/\[slug\]/page.tsx
git commit -m "feat: compute available (non-full) horarios on cerco public page"
```

---

### Task 3: Update `CercoForm` to render only available horários, with empty-state message

**Files:**
- Modify: `src/app/cerco/[slug]/CercoForm.tsx`

**Interfaces:**
- Consumes: `horarios: string[]` prop (from Task 2's `horariosDisponiveis`), `MAX_POR_HORARIO` from `@/lib/constants` (Task 1).
- Produces: nothing consumed by later tasks — this is the last task in the Cerco feature.

- [ ] **Step 1: Replace the props type and drop the `cheio`/`disabled` branch**

Current relevant parts of `src/app/cerco/[slug]/CercoForm.tsx` (after Task 1's edit):

```tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { inscreverCerco, sugerirNomesCerco } from "@/lib/actions";
import { HORARIOS_CERCO, MAX_POR_HORARIO } from "@/lib/constants";

export default function CercoForm({
  missaoId,
  setores,
  ocupados,
}: {
  missaoId: number;
  setores: string[];
  ocupados: Record<string, number>;
}) {
```

and further down:

```tsx
      <div>
        <p className="text-sm text-[var(--ink)] font-medium mb-2">
          Escolha sua hora de adoração{" "}
          <span className="text-[var(--ink-soft)]/60 font-normal">(máx. {MAX_POR_HORARIO} pessoas por horário)</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {HORARIOS_CERCO.map((h) => {
            const qtd = ocupados[h] || 0;
            const cheio = qtd >= MAX_POR_HORARIO;
            const selecionado = horario === h;
            return (
              <button
                key={h}
                type="button"
                disabled={cheio}
                onClick={() => setHorario(h)}
                className={`rounded px-3 py-2 flex justify-between text-sm border transition-colors ${
                  selecionado
                    ? "bg-[var(--brass-bright)] border-[var(--brass-bright)] text-[var(--ink)]"
                    : cheio
                    ? "bg-[var(--signal)]/10 border-[var(--signal)]/30 text-[var(--signal)] cursor-not-allowed"
                    : "bg-[var(--card)] border-[var(--line)] text-[var(--ink)]"
                }`}
              >
                <span>{h}</span>
                <span className="font-mono font-semibold">
                  {qtd}/{MAX_POR_HORARIO}
                </span>
              </button>
            );
          })}
        </div>
      </div>
```

Replace the whole file `src/app/cerco/[slug]/CercoForm.tsx` with:

```tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { inscreverCerco, sugerirNomesCerco } from "@/lib/actions";
import { MAX_POR_HORARIO } from "@/lib/constants";

export default function CercoForm({
  missaoId,
  setores,
  horarios,
  ocupados,
}: {
  missaoId: number;
  setores: string[];
  horarios: string[];
  ocupados: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(inscreverCerco, null);
  const [horario, setHorario] = useState("");
  const [nome, setNome] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChangeNome(valor: string) {
    setNome(valor);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const resultado = await sugerirNomesCerco(missaoId, valor);
      setSugestoes(resultado);
      setMostrarSugestoes(resultado.length > 0);
    }, 300);
  }

  function selecionarNome(n: string) {
    setNome(n);
    setMostrarSugestoes(false);
    setSugestoes([]);
  }

  return (
    <form action={action} className="card p-6 space-y-6">
      <input type="hidden" name="missaoId" value={missaoId} />
      <input type="hidden" name="horario" value={horario} />

      <label className="block text-sm">
        <span className="text-[var(--ink)] font-medium">Seu nome</span>
        <div className="relative">
          <input
            name="nome"
            required
            value={nome}
            onChange={(e) => handleChangeNome(e.target.value)}
            onFocus={() => setMostrarSugestoes(sugestoes.length > 0)}
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
            placeholder="Digite seu nome completo"
            autoComplete="off"
            className="input mt-1"
          />
          {mostrarSugestoes && (
            <ul className="card absolute z-10 mt-1 w-full max-h-48 overflow-auto p-1">
              {sugestoes.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    onMouseDown={() => selecionarNome(n)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[var(--paper)] text-sm"
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </label>

      <label className="block text-sm">
        <span className="text-[var(--ink)] font-medium">Seu setor</span>
        <select name="setor" required className="input mt-1">
          <option value="">Selecione seu setor...</option>
          {setores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="text-sm text-[var(--ink)] font-medium mb-2">
          Escolha sua hora de adoração{" "}
          <span className="text-[var(--ink-soft)]/60 font-normal">(máx. {MAX_POR_HORARIO} pessoas por horário)</span>
        </p>
        {horarios.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]/70 bg-[var(--paper)] rounded px-3 py-3">
            Todos os horários já estão preenchidos, obrigado por querer servir! Fale com a coordenação
            do setor.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {horarios.map((h) => {
              const qtd = ocupados[h] || 0;
              const selecionado = horario === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorario(h)}
                  className={`rounded px-3 py-2 flex justify-between text-sm border transition-colors ${
                    selecionado
                      ? "bg-[var(--brass-bright)] border-[var(--brass-bright)] text-[var(--ink)]"
                      : "bg-[var(--card)] border-[var(--line)] text-[var(--ink)]"
                  }`}
                >
                  <span>{h}</span>
                  <span className="font-mono font-semibold">
                    {qtd}/{MAX_POR_HORARIO}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {state && "error" in state && state.error && (
        <p className="text-[var(--signal)] text-sm">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-[var(--brass)] text-sm font-medium">
          Inscrição confirmada! Obrigado por servir.
        </p>
      )}

      <button disabled={pending || !horario} className="btn-primary w-full py-2.5">
        {pending ? "Enviando..." : "Confirmar horário"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: no errors (no unused imports — `HORARIOS_CERCO` is no longer imported in either file where it's not used).

- [ ] **Step 4: Manual verification with the dev server**

Run: `npm run dev` (background), then in a browser:
1. Find an existing missão's `cercoSlug` (e.g. query `SELECT cercoSlug FROM Missao ORDER BY id DESC LIMIT 1;` via a `db.missao.findFirst` script, or check `/servos` admin page for the active missão) and open `http://localhost:3005/cerco/<slug>`.
2. Confirm the horário grid renders and only shows slots with `qtd < 15`.
3. If every slot for that missão is full, confirm the "Todos os horários já estão preenchidos..." message renders instead of the grid.
4. Open `/servos/<id>` (edit an existing servo) as admin and confirm the horário `<select>` still lists all 24 slots regardless of fullness (this proves Task 2/3 didn't touch `ServoForm.tsx`).

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/app/cerco/\[slug\]/CercoForm.tsx
git commit -m "feat: hide full horarios and show empty-state message on public cerco form"
```

---

### Task 4: Extract `SetorCard` client component with collapse/expand + localStorage

**Files:**
- Create: `src/app/(admin)/servos/SetorCard.tsx`
- Modify: `src/app/(admin)/servos/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent feature).
- Produces: `SetorCard` React component, default export from `src/app/(admin)/servos/SetorCard.tsx`, with props:
  ```ts
  {
    setorNome: string;
    missaoId: number;
    servos: Prisma.ServoGetPayload<{ include: { pessoa: true } }>[];
    missoesPorPessoa: Record<number, number>;
  }
  ```
  `missoesPorPessoa` is passed as a plain object (not a `Map`) because it crosses the server→client boundary as a prop and `Map` doesn't serialize as React props the way objects do in this pattern — `page.tsx` converts the existing `Map` to an object before passing it down.

- [ ] **Step 1: Create `SetorCard.tsx`**

Create `src/app/(admin)/servos/SetorCard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { excluirServo } from "@/lib/actions";
import AdicionarServoModal from "./AdicionarServoModal";
import { CamisetaInlineSelect, PagoInlineSelect, FuncaoInlineSelect } from "./ServoInlineEdit";

type ServoComPessoa = Prisma.ServoGetPayload<{ include: { pessoa: true } }>;

function chaveLocalStorage(missaoId: number) {
  return `quadrante:setores-colapsados:${missaoId}`;
}

function lerSetoresColapsados(missaoId: number): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(chaveLocalStorage(missaoId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function salvarSetoresColapsados(missaoId: number, setores: string[]) {
  window.localStorage.setItem(chaveLocalStorage(missaoId), JSON.stringify(setores));
}

export default function SetorCard({
  setorNome,
  missaoId,
  servos,
  missoesPorPessoa,
}: {
  setorNome: string;
  missaoId: number;
  servos: ServoComPessoa[];
  missoesPorPessoa: Record<number, number>;
}) {
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    const colapsados = lerSetoresColapsados(missaoId);
    if (colapsados.includes(setorNome)) setAberto(false);
  }, [missaoId, setorNome]);

  function alternar() {
    setAberto((atual) => {
      const novo = !atual;
      const colapsados = lerSetoresColapsados(missaoId);
      const semEsse = colapsados.filter((s) => s !== setorNome);
      salvarSetoresColapsados(missaoId, novo ? semEsse : [...semEsse, setorNome]);
      return novo;
    });
  }

  return (
    <div className="mb-6 card overflow-hidden">
      <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 font-medium text-sm flex items-center justify-between">
        <button
          type="button"
          onClick={alternar}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <span className="font-mono text-xs">{aberto ? "▾" : "▸"}</span>
          <span>
            {setorNome} ({servos.length})
          </span>
        </button>
        <AdicionarServoModal missaoId={missaoId} setor={setorNome} />
      </div>
      {aberto &&
        (servos.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--ink-soft)]/60">Nenhum servo neste setor ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper)] text-[var(--ink-soft)]/60">
                <tr>
                  <th className="text-left px-4 py-2">Nome</th>
                  <th className="text-left px-4 py-2">Função</th>
                  <th className="text-left px-4 py-2">Camiseta</th>
                  <th className="text-left px-4 py-2">Cerco</th>
                  <th className="text-left px-4 py-2">Pago</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {servos.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2">
                      <Link href={`/pessoas/${s.pessoaId}`} className="hover:underline">
                        {s.pessoa.nome}
                      </Link>
                      {(missoesPorPessoa[s.pessoaId] ?? 1) > 1 && (
                        <span className="ml-2 text-[0.65rem] font-[var(--font-plex-mono)] text-[var(--brass)] border border-[var(--brass)]/40 rounded px-1 py-px align-middle whitespace-nowrap">
                          {missoesPorPessoa[s.pessoaId]}ª missão
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <FuncaoInlineSelect servoId={s.id} funcao={s.funcao} />
                    </td>
                    <td className="px-4 py-2">
                      <CamisetaInlineSelect servoId={s.id} camiseta={s.camiseta} />
                    </td>
                    <td className="px-4 py-2">{s.cercoHorario || "—"}</td>
                    <td className="px-4 py-2">
                      <PagoInlineSelect servoId={s.id} pago={s.pago} />
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Link href={`/servos/${s.id}`} className="btn-link">
                        Editar
                      </Link>
                      <form action={excluirServo} className="inline">
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn-danger-link">Excluir</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 2: Update `page.tsx` to use `SetorCard` and pass `missoesPorPessoa` as an object**

Replace the full contents of `src/app/(admin)/servos/page.tsx` with:

```tsx
import Link from "next/link";
import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES } from "@/lib/constants";
import SetorCard from "./SetorCard";

export default async function ServosPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string; q?: string }>;
}) {
  const { setor, q } = await searchParams;
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const servos = await db.servo.findMany({
    where: {
      missaoId: missao.id,
      status: "ATIVO",
      setor: setor || undefined,
      pessoa: q ? { nome: { contains: q } } : undefined,
    },
    include: { pessoa: true },
    orderBy: [{ setor: "asc" }, { pessoa: { nome: "asc" } }],
  });

  const setores = await db.setor.findMany({ orderBy: { nome: "asc" } });

  // veterania: total de missões de cada pessoa (todas as edições)
  const contagens = await db.servo.groupBy({
    by: ["pessoaId"],
    where: { pessoaId: { in: servos.map((s) => s.pessoaId) } },
    _count: true,
  });
  const missoesPorPessoa: Record<number, number> = {};
  for (const c of contagens) missoesPorPessoa[c.pessoaId] = c._count;

  const grupos = new Map<string, typeof servos>();
  for (const nomeSetor of setores.map((se) => se.nome)) {
    if (setor && nomeSetor !== setor) continue;
    grupos.set(nomeSetor, []);
  }
  for (const s of servos) {
    if (!grupos.has(s.setor)) grupos.set(s.setor, []);
    grupos.get(s.setor)!.push(s);
  }
  // dentro de cada setor: COORDENADOR -> AUXILIAR -> APOIO -> INTEGRANTE, depois por nome
  for (const lista of grupos.values()) {
    lista.sort((a, b) => {
      const fa = FUNCOES.indexOf(a.funcao);
      const fb = FUNCOES.indexOf(b.funcao);
      if (fa !== fb) return (fa === -1 ? FUNCOES.length : fa) - (fb === -1 ? FUNCOES.length : fb);
      return a.pessoa.nome.localeCompare(b.pessoa.nome);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)]">Quadrante de Servos</h1>
        <Link href="/servos/novo" className="btn-primary px-4 py-2 text-sm">
          + Novo servo
        </Link>
      </div>

      <form className="flex gap-3 mb-6">
        <input name="q" defaultValue={q} placeholder="Buscar por nome" className="input text-sm" />
        <select name="setor" defaultValue={setor || ""} className="input text-sm">
          <option value="">Todos os setores</option>
          {setores.map((s) => (
            <option key={s.id}>{s.nome}</option>
          ))}
        </select>
        <button className="btn-primary px-4 py-2 text-sm">Filtrar</button>
      </form>

      {[...grupos.entries()].map(([setorNome, lista]) => (
        <SetorCard
          key={setorNome}
          setorNome={setorNome}
          missaoId={missao.id}
          servos={lista}
          missoesPorPessoa={missoesPorPessoa}
        />
      ))}
      {grupos.size === 0 && <p className="text-[var(--ink-soft)]/60">Nenhum setor encontrado.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors. If `Prisma.ServoGetPayload<{ include: { pessoa: true } }>` doesn't structurally match the `servos` array from `db.servo.findMany({ ..., include: { pessoa: true } })`, TypeScript will report a mismatch at the `<SetorCard servos={lista} ...>` call site — if that happens, check the exact shape Prisma generates for this project's schema (open `node_modules/.prisma/client/index.d.ts` and search for `ServoGetPayload`) and adjust the type in `SetorCard.tsx` to match exactly.

- [ ] **Step 4: Verify lint**

Run: `npm run lint`
Expected: no errors, no unused imports (`excluirServo` moved into `SetorCard.tsx`; confirm `page.tsx` no longer imports it or `AdicionarServoModal` or the inline-edit components, since those are now only used inside `SetorCard.tsx`).

- [ ] **Step 5: Manual verification with the dev server**

Run: `npm run dev` (background), then in a browser:
1. Open `/servos` for the active missão. Confirm all setor cards render exactly as before (same table columns, same data), each showing a `▾` caret before the setor name.
2. Click a setor's header (not the "add servo" button) → its table collapses, caret becomes `▸`, only the header row remains visible.
3. Reload the page → the setor you collapsed stays collapsed (caret still `▸`, table hidden). This confirms localStorage persistence.
4. Click the same header again → expands, caret back to `▾`. Reload → stays expanded.
5. Confirm clicking "+ [add servo]" inside a card's header still opens the `AdicionarServoModal` and does not toggle collapse (they're separate click targets, not nested).
6. Confirm "Editar" / "Excluir" / inline selects (função, camiseta, pago) inside an expanded card still work exactly as before.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(admin\)/servos/SetorCard.tsx src/app/\(admin\)/servos/page.tsx
git commit -m "feat: collapsible setor cards on Quadrante de Servos, state persisted in localStorage"
```

---

### Task 5: Final full-project verification

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: succeeds with no errors or warnings related to the changed files.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Confirm git log shows all 4 feature commits plus this plan/spec**

Run: `git log --oneline -8`
Expected: sees the commits from Tasks 1–4 in order, plus the earlier spec commit.

- [ ] **Step 4: No further commit needed for this task (verification-only).**
