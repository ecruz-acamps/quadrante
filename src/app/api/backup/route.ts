import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { criarSnapshot, verificarSnapshot } from "@/lib/snapshotDb";
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

  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "qd-dl-"));
  const copia = path.join(pasta, "quadrante.db");

  try {
    // snapshot consistente (VACUUM INTO) em vez de copiar o arquivo com o app em uso
    await criarSnapshot(db, copia);
    const verificacao = await verificarSnapshot(copia);
    if (!verificacao.ok) throw new Error(`snapshot reprovado: ${verificacao.detalhe}`);
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
