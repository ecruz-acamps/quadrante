// Cópia consistente do SQLite em uso (VACUUM INTO) e checagem de integridade.
// Copiar o arquivo .db com o app aberto pode gerar uma cópia quebrada; o VACUUM INTO não.
import { PrismaClient } from "@prisma/client";

type ExecutorSql = Pick<PrismaClient, "$executeRawUnsafe">;

// `destino` não pode existir ainda (o SQLite recusa sobrescrever)
export async function criarSnapshot(prisma: ExecutorSql, destino: string) {
  if (destino.includes("'")) throw new Error("Caminho de snapshot inválido.");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${destino}'`);
}

export type ResultadoVerificacao = { ok: boolean; detalhe: string; pessoas: number };

// abre o arquivo isoladamente e confere integridade + se há dados; nunca lança exceção
export async function verificarSnapshot(caminho: string): Promise<ResultadoVerificacao> {
  const prisma = new PrismaClient({ datasourceUrl: `file:${caminho}` });
  try {
    const integridade = await prisma.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
    if (integridade.length !== 1 || integridade[0].integrity_check !== "ok") {
      return { ok: false, detalhe: `integrity_check: ${integridade.map((l) => l.integrity_check).join("; ")}`, pessoas: 0 };
    }
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>("SELECT COUNT(*) AS n FROM Pessoa");
    return { ok: true, detalhe: "ok", pessoas: Number(n) };
  } catch (err) {
    return { ok: false, detalhe: (err as Error).message.split("\n").slice(-1)[0] || "erro ao abrir o arquivo", pessoas: 0 };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
