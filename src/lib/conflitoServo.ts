import { db } from "./db";
import { avisoChamado } from "./chamado";

export type ConflitoServo = {
  missaoConflitoId: number;
  missaoConflitoNome: string;
  distancia: number;
  aviso?: string; // conflito por aviso interno da pessoa (não por proximidade de missões)
};

// checa se `pessoaId` já é servo ATIVO em outra missão a menos de 3 meses de `missaoDestinoId`.
// só compara missões que tenham `mes` e `anoCalendario` preenchidos — sem essa data, a missão nunca conflita.
export async function checarConflitoServo(
  pessoaId: number,
  missaoDestinoId: number
): Promise<ConflitoServo | null> {
  const pessoa = await db.pessoa.findUnique({ where: { id: pessoaId }, select: { nome: true } });
  const aviso = pessoa ? avisoChamado(pessoa.nome) : null;
  if (aviso) return { missaoConflitoId: 0, missaoConflitoNome: "", distancia: 0, aviso };

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
