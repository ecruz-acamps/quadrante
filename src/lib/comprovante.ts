// Comprovante do PIX da ficha do neocampista.
// Regra: pagamento PIX sem comprovante enviado não pode ficar "OK - PAGO"; fica PENDENTE.
// O arquivo vai para o OneDrive em <Missão>/Comprovantes PIX/012 - Nome - PIX.pdf (vai com o nome original e é
// renomeado logo em seguida, como as fichas).
import type { PrismaClient } from "@prisma/client";
import type { Arquivos } from "./oneDrive";
import { extensaoDe } from "./fichaArquivos";

export const PASTA_COMPROVANTES = "Comprovantes PIX";
export const EXTENSOES_COMPROVANTE = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".webp"];

export function exigeComprovante(pagamento: string | null | undefined) {
  return pagamento === "PIX";
}

// situação que pode ser gravada: "OK" vira "PENDENTE" quando é PIX e não há comprovante
export function situacaoPermitida(pagamento: string | null | undefined, situacao: string, temComprovante: boolean): string {
  return situacao === "OK" && exigeComprovante(pagamento) && !temComprovante ? "PENDENTE" : situacao;
}

export function nomeComprovante(numero: number, nome: string, ext: string) {
  return `${String(numero).padStart(3, "0")} - ${nome.trim().replace(/\s+/g, " ")} - PIX${ext}`;
}

type Db = Pick<PrismaClient, "neocampista">;

export async function enviarComprovante(fichaId: number, nomeOriginal: string, conteudo: Buffer, db: Db, od: Arquivos) {
  const f = await db.neocampista.findUniqueOrThrow({ where: { id: fichaId }, include: { missao: { select: { nome: true } } } });
  // o anterior (se houver) vai para a lixeira do OneDrive
  if (f.comprovanteItemId && f.comprovanteDriveId) await od.apagar({ driveId: f.comprovanteDriveId, id: f.comprovanteItemId });
  const pasta = await od.garantirPasta([f.missao.nome, PASTA_COMPROVANTES]);
  const enviado = await od.enviar(pasta, nomeOriginal, conteudo, "rename");
  const renomeado = await od.renomear(enviado, nomeComprovante(f.numero, f.nome, extensaoDe(nomeOriginal)));
  return db.neocampista.update({
    where: { id: fichaId },
    data: {
      comprovanteDriveId: renomeado.driveId,
      comprovanteItemId: renomeado.id,
      comprovanteNome: renomeado.name,
      comprovanteUrl: renomeado.webUrl ?? enviado.webUrl ?? null,
    },
  });
}

// Tira o comprovante (lixeira do OneDrive). Ficha PIX que estava OK volta para PENDENTE.
export async function removerComprovante(fichaId: number, db: Db, od: Arquivos) {
  const f = await db.neocampista.findUniqueOrThrow({ where: { id: fichaId } });
  if (f.comprovanteItemId && f.comprovanteDriveId) await od.apagar({ driveId: f.comprovanteDriveId, id: f.comprovanteItemId });
  return db.neocampista.update({
    where: { id: fichaId },
    data: {
      comprovanteDriveId: null,
      comprovanteItemId: null,
      comprovanteNome: null,
      comprovanteUrl: null,
      situacao: situacaoPermitida(f.pagamento, f.situacao, false),
    },
  });
}

// Mudou nome ou número da ficha: o comprovante acompanha
export async function renomearComprovante(
  f: { numero: number; nome: string; comprovanteDriveId: string | null; comprovanteItemId: string | null; comprovanteNome: string | null; id: number },
  db: Db,
  od: Arquivos,
) {
  if (!f.comprovanteItemId || !f.comprovanteDriveId || !f.comprovanteNome) return;
  const desejado = nomeComprovante(f.numero, f.nome, extensaoDe(f.comprovanteNome));
  if (desejado === f.comprovanteNome) return;
  const r = await od.renomear({ driveId: f.comprovanteDriveId, id: f.comprovanteItemId }, desejado);
  await db.neocampista.update({ where: { id: f.id }, data: { comprovanteNome: r.name, comprovanteUrl: r.webUrl ?? undefined } });
}
