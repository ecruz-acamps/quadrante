// Reserva de horário do Cerco de Jericó.
// A contagem e a gravação acontecem num ÚNICO UPDATE condicional: o SQLite executa cada comando de escrita
// de forma exclusiva, então duas pessoas disputando a última vaga nunca passam as duas (antes eram um SELECT
// seguido de um UPDATE, com uma brecha no meio).
import type { PrismaClient } from "@prisma/client";

type ExecutorSql = Pick<PrismaClient, "$executeRaw">;

// true se o servo ficou com o horário; false se lotou, se o limite é inválido ou se o servo não é da missão
export async function reservarHorarioCerco(
  prisma: ExecutorSql,
  { servoId, missaoId, horario, max }: { servoId: number; missaoId: number; horario: string; max: number },
): Promise<boolean> {
  if (!Number.isInteger(max) || max < 1) return false;
  const alterados = await prisma.$executeRaw`
    UPDATE "Servo" SET "cercoHorario" = ${horario}
    WHERE "id" = ${servoId} AND "missaoId" = ${missaoId}
      AND (
        SELECT COUNT(*) FROM "Servo"
        WHERE "missaoId" = ${missaoId} AND "status" = 'ATIVO' AND "cercoHorario" = ${horario} AND "id" <> ${servoId}
      ) < ${max}`;
  return alterados === 1;
}
