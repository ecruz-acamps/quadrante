import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { criarSnapshot, verificarSnapshot } from "@/lib/snapshotDb";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function timestamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export async function GET(request: Request) {
  await requireRole("SUPER");
  // ?completo=1: pacote para levar o sistema a outro servidor (banco + .env, sem criptografia), aceito pela tela /restaurar
  const completo = new URL(request.url).searchParams.get("completo") === "1";

  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "qd-dl-"));
  const copia = path.join(pasta, "quadrante.db");

  try {
    // snapshot consistente (VACUUM INTO) em vez de copiar o arquivo com o app em uso
    await criarSnapshot(db, copia);
    const verificacao = await verificarSnapshot(copia);
    if (!verificacao.ok) throw new Error(`snapshot reprovado: ${verificacao.detalhe}`);
    if (completo) {
      await fs.mkdir(path.join(pasta, "prisma"));
      await fs.rename(copia, path.join(pasta, "prisma", "quadrante.db"));
      await fs.copyFile(path.join(process.cwd(), ".env"), path.join(pasta, ".env"));
      const pacote = path.join(pasta, "pacote.tar.gz");
      await execFileAsync("tar", ["-czf", pacote, "-C", pasta, "prisma", ".env"]);
      return new Response(new Uint8Array(await fs.readFile(pacote)), {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="quadrante-transferencia-${timestamp()}.tar.gz"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const bytes = await fs.readFile(copia);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="quadrante-backup-${timestamp()}.db"`,
      },
    });
  } catch (err) {
    return new Response(`Falha ao gerar backup: ${(err as Error).message}`, { status: 500 });
  } finally {
    await fs.rm(pasta, { recursive: true, force: true });
  }
}
