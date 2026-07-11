# Backup Manual do Banco (Superadmin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `SUPER`-role user download a timestamped copy of the live SQLite database (`prisma/quadrante.db`) from the browser.

**Architecture:** A new route handler (`src/app/api/backup/route.ts`) copies the db file to a temp path, streams it back as an attachment, then deletes the temp copy. A new admin page (`src/app/(admin)/backup/page.tsx`) exposes a download link, gated by `requireRole("SUPER")`, and is added to the admin nav as a `superOnly` entry.

**Tech Stack:** Next.js 16 App Router route handlers, Node `fs/promises`, existing `requireRole` auth helper (`src/lib/auth.ts`). No new dependencies.

## Global Constraints

- This repo has no automated test runner configured (no jest/vitest/pytest in `package.json`) — verification is via `npm run lint`, `npm run build`, and manual browser/curl checks, not automated unit tests.
- Follow existing patterns exactly: `requireRole("SUPER")` from `src/lib/auth.ts:45-49` for access control (redirects to `/` if not SUPER, to `/login` if unauthenticated).
- DB file lives at `/home/true/quadrante/app/prisma/quadrante.db` (from `DATABASE_URL="file:./quadrante.db"` in `.env`, resolved relative to `prisma/`).
- Nav entries in `src/app/(admin)/layout.tsx` are `[path, label, superOnly]` tuples (see `NAV` array, layout.tsx:6-22); the layout auto-filters by `isSuper` (layout.tsx:32) — no extra wiring needed beyond adding the tuple.
- Match the existing visual style: `src/app/(admin)/usuarios/page.tsx` shows the CSS variable / class conventions (`font-[var(--font-spectral)]`, `text-[var(--ink)]`, `.card`, `text-[var(--brass)]` links) to reuse on the new page.

---

### Task 1: Route handler that serves a backup download

**Files:**
- Create: `src/app/api/backup/route.ts`

**Interfaces:**
- Consumes: `requireRole` from `@/lib/auth` (signature: `requireRole(role: "SUPER"): Promise<Usuario>`, redirects via `next/navigation` if unauthorized — no try/catch needed, it throws Next's redirect internally).
- Produces: `GET` handler at `/api/backup` returning a `Response` with the `.db` file bytes and `Content-Disposition: attachment; filename="quadrante-backup-<timestamp>.db"`. Task 2 links to this URL.

- [ ] **Step 1: Write the route handler**

```typescript
// src/app/api/backup/route.ts
import { requireRole } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import os from "os";

function timestamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export async function GET() {
  await requireRole("SUPER");

  const dbPath = path.join(process.cwd(), "prisma", "quadrante.db");
  const tmpPath = path.join(os.tmpdir(), `quadrante-backup-${Date.now()}.db`);

  try {
    await fs.copyFile(dbPath, tmpPath);
    const bytes = await fs.readFile(tmpPath);
    const filename = `quadrante-backup-${timestamp()}.db`;

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return new Response(`Falha ao gerar backup: ${(err as Error).message}`, { status: 500 });
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
```

- [ ] **Step 2: Verify the project still builds**

Run: `cd /home/true/quadrante/app && npm run build`
Expected: build completes with no TypeScript errors mentioning `route.ts`.

- [ ] **Step 3: Manual check as SUPER user**

Run: `cd /home/true/quadrante/app && npm run dev` (leave it running), then in another terminal, using a valid `quadrante_session` cookie for a SUPER user (log in via the browser first at `http://localhost:3005/login` with `admin@quadrante.local` / `quadrante123`, then copy the `quadrante_session` cookie value from devtools):

```bash
curl -i --cookie "quadrante_session=<paste-cookie-value>" http://localhost:3005/api/backup -o /tmp/quadrante-backup-test.db
```

Expected: HTTP 200, `Content-Disposition: attachment; filename="quadrante-backup-..."` header present, and `/tmp/quadrante-backup-test.db` is a valid SQLite file (`file /tmp/quadrante-backup-test.db` should report `SQLite 3.x database`).

- [ ] **Step 4: Manual check as non-SUPER / unauthenticated**

Run without a cookie:
```bash
curl -i http://localhost:3005/api/backup
```
Expected: HTTP 307/302 redirect to `/login` (from `requireUser` inside `requireRole`).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/backup/route.ts
git commit -m "feat: add superadmin database backup download endpoint"
```

---

### Task 2: Admin page with download button + nav entry

**Files:**
- Create: `src/app/(admin)/backup/page.tsx`
- Modify: `src/app/(admin)/layout.tsx:6-22` (add nav entry)

**Interfaces:**
- Consumes: `requireRole` from `@/lib/auth` (same as Task 1); the `/api/backup` endpoint produced by Task 1.
- Produces: page rendered at `/backup`, reachable from the admin nav for SUPER users only.

- [ ] **Step 1: Add the nav entry**

In `src/app/(admin)/layout.tsx`, edit the `NAV` array (currently lines 6-22) to add a `Backup` entry alongside the other `superOnly` items:

```typescript
const NAV = [
  ["/", "Início", false],
  ["/servos", "Quadrante de Servos", false],
  ["/cerco-dashboard", "Cerco de Jericó", false],
  ["/camisetas", "Camisetas", false],
  ["/setores", "Por Setor", false],
  ["/cidades", "Por Cidade", false],
  ["/fichas", "Fichas (Neocampistas)", false],
  ["/tribos", "Tribos", false],
  ["/financeiro", "Financeiro", false],
  ["/registros", "Não / Desistências / Faltas", false],
  ["/pessoas", "Pessoas", false],
  ["/estatisticas", "Estatísticas", true],
  ["/duplicatas", "Possíveis Duplicatas", true],
  ["/missoes", "Missões", true],
  ["/usuarios", "Usuários", true],
  ["/backup", "Backup", true],
] as const;
```

- [ ] **Step 2: Write the backup page**

```tsx
// src/app/(admin)/backup/page.tsx
import { requireRole } from "@/lib/auth";

export default async function BackupPage() {
  await requireRole("SUPER");

  return (
    <div className="max-w-2xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Backup</h1>

      <div className="card p-4">
        <p className="text-sm text-[var(--ink-soft)]/80 mb-4">
          Baixa uma cópia completa do banco de dados no estado atual. Guarde o arquivo em
          um local seguro (ex: seu computador ou um serviço de nuvem).
        </p>
        <a
          href="/api/backup"
          className="inline-block rounded px-4 py-2 bg-[var(--brass)] text-[var(--ink)] font-medium"
        >
          Baixar backup
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the project still builds and lints**

Run: `cd /home/true/quadrante/app && npm run lint && npm run build`
Expected: both complete with no errors related to `backup/page.tsx` or `layout.tsx`.

- [ ] **Step 4: Manual check — SUPER sees and can use the link**

Run: `npm run dev`, log in as `admin@quadrante.local` / `quadrante123` (this seeded user is SUPER, per `[[quadrante-app-overview]]`) at `http://localhost:3005/login`, confirm the "Backup" link appears in the sidebar nav, click it, confirm the page renders, click "Baixar backup", confirm a `.db` file downloads.

- [ ] **Step 5: Manual check — non-SUPER cannot see or use it**

Log in (or create via `/usuarios`) as an `ADMIN`-role user, confirm the "Backup" nav link is absent, and confirm navigating directly to `http://localhost:3005/backup` redirects to `/` (per `requireRole` behavior).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/backup/page.tsx" "src/app/(admin)/layout.tsx"
git commit -m "feat: add backup page and nav entry for superadmin"
```

---

## Self-Review Notes

- **Spec coverage:** nav entry ✅ (Task 2 Step 1), page with `requireRole("SUPER")` ✅ (Task 2 Step 2), route handler with double auth check + timestamped filename + temp-file copy/cleanup ✅ (Task 1 Step 1), error handling on copy/read failure ✅ (Task 1 Step 1 try/finally), manual test plan for SUPER and non-SUPER ✅ (Task 1 Steps 3-4, Task 2 Steps 4-5).
- **Placeholder scan:** no TBD/TODO; all steps contain full code or exact commands.
- **Type consistency:** `requireRole("SUPER")` signature matches `src/lib/auth.ts:45` in both tasks; route path `/api/backup` matches between Task 1 (handler location) and Task 2 (link `href`).
