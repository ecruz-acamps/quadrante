import type { PrismaClient } from "@prisma/client";

// valida um código de liberação de conflito; se válido, marca como usado e retorna true.
// Fica fora de actions.ts ("use server") para não virar uma action chamável pelo navegador.
export async function validarELiberarCodigo(db: PrismaClient, pessoaId: number, missaoId: number, codigo: string | null) {
  if (!codigo) return false;
  const resultado = await db.liberacaoConflitoServo.updateMany({
    where: { pessoaId, missaoId, codigo, usado: false, expiraEm: { gt: new Date() } },
    data: { usado: true },
  });
  return resultado.count === 1;
}
