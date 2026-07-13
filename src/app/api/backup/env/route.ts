import { requireRole } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

function timestamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export async function GET() {
  await requireRole("SUPER");

  const envPath = path.join(process.cwd(), ".env");

  try {
    const bytes = await fs.readFile(envPath);
    const filename = `quadrante-env-${timestamp()}.env`;

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return new Response(`Falha ao gerar backup do .env: ${(err as Error).message}`, { status: 500 });
  }
}
