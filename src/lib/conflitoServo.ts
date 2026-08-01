import { db } from "./db";

export type ConflitoServo = {
  missaoConflitoId: number;
  missaoConflitoNome: string;
  distancia: number;
};

// checa se `pessoaId` já é servo ATIVO em outra missão a menos de 3 meses de `missaoDestinoId`.
// só compara missões que tenham `mes` e `anoCalendario` preenchidos — sem essa data, a missão nunca conflita.
export async function checarConflitoServo(
  pessoaId: number,
  missaoDestinoId: number
): Promise<ConflitoServo | null> {
  const destino = await db.missao.findUniqueOrThrow({ where: { id: missaoDestinoId } });
  if (destino.mes == null || destino.anoCalendario == null) return null;

  const outros = await db.servo.findMany({
    where: { pessoaId, status: "ATIVO", missaoId: { not: missaoDestinoId } },
    include: { missao: true },
  });

  for (const s of outros) {
    const m = s.missao;
    if (m.mes == null || m.anoCalendario == null) continue;
    const distancia = Math.abs((destino.anoCalendario - m.anoCalendario) * 12 + (destino.mes - m.mes));
    if (distancia < 3) {
      return { missaoConflitoId: m.id, missaoConflitoNome: m.nome, distancia };
    }
  }
  return null;
}

export function gerarCodigo6Digitos(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
