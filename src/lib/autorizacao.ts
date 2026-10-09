// Autorização por missão: o id que chega do navegador nunca é confiável.
// Cada função descobre a missão do registro no banco e confere se o usuário pode acessá-la.
import { db } from "./db";

type Usuario = { id: number; role: string };

// ADMIN só acessa missões vinculadas a ele; SUPER acessa todas
export async function podeAcessarMissao(user: Usuario, missaoId: number) {
  if (!Number.isInteger(missaoId) || missaoId <= 0) return false;
  if (user.role === "SUPER") return true;
  const vinculo = await db.usuarioMissao.findUnique({
    where: { usuarioId_missaoId: { usuarioId: user.id, missaoId } },
  });
  return Boolean(vinculo);
}

export type TipoRegistro = "servo" | "ficha" | "tribo" | "alerta" | "liderTribo";
export type RefRegistro = readonly [TipoRegistro, number];

// missão a que o registro pertence (null se não existir ou se o id for inválido)
async function missaoDe([tipo, id]: RefRegistro): Promise<number | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  switch (tipo) {
    case "servo":
      return (await db.servo.findUnique({ where: { id }, select: { missaoId: true } }))?.missaoId ?? null;
    case "ficha":
      return (await db.neocampista.findUnique({ where: { id }, select: { missaoId: true } }))?.missaoId ?? null;
    case "tribo":
      return (await db.tribo.findUnique({ where: { id }, select: { missaoId: true } }))?.missaoId ?? null;
    case "alerta":
      return (
        (await db.fichaAlerta.findUnique({ where: { id }, select: { origem: { select: { missaoId: true } } } }))?.origem
          .missaoId ?? null
      );
    case "liderTribo":
      return (
        (await db.triboLider.findUnique({ where: { id }, select: { tribo: { select: { missaoId: true } } } }))?.tribo
          .missaoId ?? null
      );
  }
}

// true só se TODOS os registros existem, estão na MESMA missão e o usuário acessa essa missão.
// Passar mais de um registro impede misturar missões (ex.: ficha de uma missão com tribo de outra).
export async function acessoRegistros(user: Usuario, ...refs: RefRegistro[]) {
  if (refs.length === 0) return false;
  const missoes = await Promise.all(refs.map(missaoDe));
  const primeira = missoes[0];
  if (primeira === null || missoes.some((m) => m !== primeira)) return false;
  return podeAcessarMissao(user, primeira);
}

const SEM_PERMISSAO = "Sem permissão para este registro.";

export async function exigirMissao(user: Usuario, missaoId: number) {
  if (!(await podeAcessarMissao(user, missaoId))) throw new Error(SEM_PERMISSAO);
}

export async function exigirRegistros(user: Usuario, ...refs: RefRegistro[]) {
  if (!(await acessoRegistros(user, ...refs))) throw new Error(SEM_PERMISSAO);
}
