"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { acessoRegistros, podeAcessarMissao } from "./autorizacao";
import { db } from "./db";
import { oneDrive } from "./oneDrive";
import { removerArquivoFicha, removerParteFicha, sincronizarFicha, sincronizarMissao } from "./fichaArquivos";
import { removerComprovante } from "./comprovante";

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

// Tira um arquivo da ficha (vai para a lixeira do OneDrive); os outros são renumerados
export async function removerArquivoFichaAction(arquivoId: number): Promise<{ erro?: string }> {
  const usuario = await requireUser();
  const a = await db.fichaArquivo.findUnique({ where: { id: arquivoId }, select: { neocampistaId: true } });
  if (!a || !(await acessoRegistros(usuario, ["ficha", a.neocampistaId]))) return { erro: "Sem acesso a este arquivo." };
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) return { erro: "O OneDrive não está conectado (Configurações)." };
  const r = await removerArquivoFicha(arquivoId, db, oneDrive(db));
  revalidatePath("/fichas");
  revalidatePath(`/fichas/${a.neocampistaId}`);
  return r.ok ? {} : { erro: r.erro };
}

// Tira o comprovante do PIX (lixeira do OneDrive); ficha PIX que estava OK volta para PENDENTE
export async function removerComprovanteAction(fichaId: number): Promise<{ erro?: string }> {
  const usuario = await requireUser();
  if (!(await acessoRegistros(usuario, ["ficha", fichaId]))) return { erro: "Sem acesso a esta ficha." };
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) return { erro: "O OneDrive não está conectado (Configurações)." };
  try {
    await removerComprovante(fichaId, db, oneDrive(db));
  } catch (e) {
    return { erro: (e as Error).message };
  }
  revalidatePath("/fichas");
  revalidatePath(`/fichas/${fichaId}`);
  return {};
}

// Tira uma parte (ex.: uma das fotos) do PDF único da ficha
export async function removerParteFichaAction(arquivoId: number, indice: number): Promise<{ erro?: string }> {
  const usuario = await requireUser();
  const a = await db.fichaArquivo.findUnique({ where: { id: arquivoId }, select: { neocampistaId: true } });
  if (!a || !(await acessoRegistros(usuario, ["ficha", a.neocampistaId]))) return { erro: "Sem acesso a este arquivo." };
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) return { erro: "O OneDrive não está conectado (Configurações)." };
  let r;
  try {
    r = await removerParteFicha(arquivoId, indice, db, oneDrive(db));
  } catch (e) {
    return { erro: (e as Error).message };
  }
  revalidatePath("/fichas");
  revalidatePath(`/fichas/${a.neocampistaId}`);
  return r.ok ? {} : { erro: r.erro };
}
