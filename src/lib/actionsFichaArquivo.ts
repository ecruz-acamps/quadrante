"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { acessoRegistros, podeAcessarMissao } from "./autorizacao";
import { db } from "./db";
import { oneDrive } from "./oneDrive";
import { sincronizarFicha, sincronizarMissao } from "./fichaArquivos";

// "Tentar de novo" numa ficha cujo arquivo ficou fora de ordem no OneDrive
export async function sincronizarFichaAction(fichaId: number): Promise<{ erro?: string }> {
  const usuario = await requireUser();
  if (!(await acessoRegistros(usuario, ["ficha", fichaId]))) return { erro: "Sem acesso a esta ficha." };
  oneDrive(db).esquecerPastas();
  const r = await sincronizarFicha(fichaId, db, oneDrive(db));
  revalidatePath("/fichas");
  revalidatePath("/tribos");
  return r.ok ? {} : { erro: r.erro };
}

// Botão em Tribos: confere todas as fichas com arquivo da missão (nomes e pastas das tribos)
export async function sincronizarMissaoAction(missaoId: number): Promise<{ erro?: string; total?: number; falhas?: number }> {
  const usuario = await requireUser();
  if (!(await podeAcessarMissao(usuario, missaoId))) return { erro: "Sem acesso a esta missão." };
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) return { erro: "O OneDrive não está conectado (Configurações)." };
  oneDrive(db).esquecerPastas();
  const r = await sincronizarMissao(missaoId, db, oneDrive(db));
  revalidatePath("/fichas");
  revalidatePath("/tribos");
  return { total: r.total, falhas: r.falhas.length };
}
