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
