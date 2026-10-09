// Apoio aos testes: cria um banco SQLite temporário e vazio (via migrações). Nunca toca em prisma/quadrante.db.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function criarBancoTemporario() {
  const dir = mkdtempSync(join(tmpdir(), "qd-test-"));
  const arquivo = join(dir, "teste.db");
  const url = `file:${arquivo}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  return { dir, arquivo, url, limpar: () => rmSync(dir, { recursive: true, force: true }) };
}
