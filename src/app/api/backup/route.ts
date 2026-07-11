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
