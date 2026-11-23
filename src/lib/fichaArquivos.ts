// Ficha preenchida no OneDrive.
//
// Na pasta raiz (ver src/lib/oneDrive.ts):
//   <Missão>/Fichas/012 - Maria da Silva - AZUL.pdf         todas as fichas (a original)
//   <Missão>/Tribos/AZUL/012 - Maria da Silva - AZUL.pdf    cópia na pasta da cor da tribo
//
// 1. O upload vai com o nome original do arquivo e em seguida é renomeado para "NNN - Nome[ - COR]".
// 2. Com tribo (sorteio ou troca manual), a ficha ganha uma cópia na pasta da cor. Trocou de tribo: a cópia sai
//    da pasta antiga (vai para a lixeira do OneDrive) e entra na nova, e os nomes passam a trazer a cor nova.
//
// sincronizarFicha compara o que está gravado com o que deveria estar e faz só o que falta. Por isso pode ser
// chamada de novo depois de uma falha (botão "Sincronizar com o OneDrive" em Tribos) sem duplicar nada.
import type { PrismaClient } from "@prisma/client";
import type { Arquivos } from "./oneDrive";

export const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB (o proxy do Next limita o corpo do envio a 10 MB)
export const EXTENSOES = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".webp", ".doc", ".docx"];

export function corDaTribo(nomeTribo: string): string {
  return nomeTribo.replace(/^\s*tribo\s+/i, "").trim().toUpperCase();
}

export function extensaoDe(nomeArquivo: string): string {
  const m = /\.[A-Za-z0-9]{1,8}$/.exec(nomeArquivo.trim());
  return m ? m[0].toLowerCase() : "";
}

export function nomeArquivoFicha(numero: number, nome: string, tribo: string | null, ext: string): string {
  const partes = [String(numero).padStart(3, "0"), nome.trim().replace(/\s+/g, " ")];
  if (tribo) partes.push(corDaTribo(tribo));
  return `${partes.join(" - ")}${ext}`;
}

export function caminhoFichas(missaoNome: string) {
  return [missaoNome, "Fichas"];
}

export function caminhoTribo(missaoNome: string, nomeTribo: string) {
  return [missaoNome, "Tribos", corDaTribo(nomeTribo)];
}

type Db = Pick<PrismaClient, "neocampista">;

// uma sincronização por ficha de cada vez (sorteio em segundo plano + troca manual ao mesmo tempo)
const filas = new Map<number, Promise<unknown>>();
function emFila<T>(fichaId: number, tarefa: () => Promise<T>): Promise<T> {
  const anterior = filas.get(fichaId) ?? Promise.resolve();
  const atual = anterior.catch(() => {}).then(tarefa);
  const fim = atual.finally(() => {
    if (filas.get(fichaId) === fim) filas.delete(fichaId);
  });
  filas.set(fichaId, fim);
  return atual;
}

function mensagem(e: unknown) {
  return (e instanceof Error ? e.message : String(e)).slice(0, 500);
}

export type ResultadoSync = { ok: true } | { ok: false; erro: string };

export function sincronizarFicha(fichaId: number, db: Db, arquivos: Arquivos): Promise<ResultadoSync> {
  return emFila(fichaId, async () => {
    try {
      await sincronizarAgora(fichaId, db, arquivos);
      await db.neocampista.updateMany({ where: { id: fichaId, NOT: { arquivoErro: null } }, data: { arquivoErro: null } });
      return { ok: true } as const;
    } catch (e) {
      const erro = mensagem(e);
      await db.neocampista.updateMany({ where: { id: fichaId }, data: { arquivoErro: erro } }).catch(() => {});
      return { ok: false, erro } as const;
    }
  });
}

async function sincronizarAgora(fichaId: number, db: Db, arquivos: Arquivos) {
  const f = await db.neocampista.findUnique({
    where: { id: fichaId },
    include: { tribo: { select: { id: true, nome: true } }, missao: { select: { nome: true } } },
  });
  if (!f || !f.arquivoId || !f.arquivoDriveId) return;

  const ext = f.arquivoExt ?? extensaoDe(f.arquivoNome ?? "");
  const desejado = nomeArquivoFicha(f.numero, f.nome, f.tribo?.nome ?? null, ext);
  const original = { driveId: f.arquivoDriveId, id: f.arquivoId };

  // 1. nome da original
  if (f.arquivoNome !== desejado) {
    const r = await arquivos.renomear(original, desejado);
    await db.neocampista.update({ where: { id: f.id }, data: { arquivoNome: r.name, arquivoUrl: r.webUrl ?? f.arquivoUrl } });
  }

  // 2. cópia na pasta da tribo
  const copia = f.arquivoCopiaId && f.arquivoCopiaDriveId ? { driveId: f.arquivoCopiaDriveId, id: f.arquivoCopiaId } : null;
  const triboCerta = copia && f.arquivoTriboId === (f.tribo?.id ?? null);

  if (copia && !triboCerta) {
    await arquivos.apagar(copia); // saiu da tribo antiga (ou ficou sem tribo)
    await db.neocampista.update({
      where: { id: f.id },
      data: { arquivoCopiaDriveId: null, arquivoCopiaId: null, arquivoCopiaNome: null, arquivoTriboId: null },
    });
  }

  if (f.tribo && !triboCerta) {
    const pasta = await arquivos.garantirPasta(caminhoTribo(f.missao.nome, f.tribo.nome));
    const conteudo = await arquivos.baixar(original);
    const nova = await arquivos.enviar(pasta, desejado, conteudo, "replace");
    await db.neocampista.update({
      where: { id: f.id },
      data: { arquivoCopiaDriveId: nova.driveId, arquivoCopiaId: nova.id, arquivoCopiaNome: nova.name, arquivoTriboId: f.tribo.id },
    });
  } else if (f.tribo && copia && f.arquivoCopiaNome !== desejado) {
    // mesma tribo, mas mudou o nome ou o número da ficha
    const r = await arquivos.renomear(copia, desejado);
    await db.neocampista.update({ where: { id: f.id }, data: { arquivoCopiaNome: r.name } });
  }
}

// Upload (ou troca) da ficha preenchida: envia com o nome original e depois sincroniza (renomeia e copia).
export async function enviarFichaPreenchida(
  fichaId: number,
  nomeOriginal: string,
  conteudo: Buffer,
  db: Db,
  arquivos: Arquivos,
): Promise<ResultadoSync> {
  const f = await db.neocampista.findUniqueOrThrow({ where: { id: fichaId }, include: { missao: { select: { nome: true } } } });
  const ext = extensaoDe(nomeOriginal);

  // a anterior (e a cópia dela) vão para a lixeira do OneDrive
  await emFila(fichaId, async () => {
    if (f.arquivoId && f.arquivoDriveId) await arquivos.apagar({ driveId: f.arquivoDriveId, id: f.arquivoId });
    if (f.arquivoCopiaId && f.arquivoCopiaDriveId) await arquivos.apagar({ driveId: f.arquivoCopiaDriveId, id: f.arquivoCopiaId });
    const pasta = await arquivos.garantirPasta(caminhoFichas(f.missao.nome));
    const item = await arquivos.enviar(pasta, nomeOriginal, conteudo, "rename");
    await db.neocampista.update({
      where: { id: fichaId },
      data: {
        arquivoDriveId: item.driveId,
        arquivoId: item.id,
        arquivoNome: item.name,
        arquivoExt: ext,
        arquivoUrl: item.webUrl ?? null,
        arquivoCopiaDriveId: null,
        arquivoCopiaId: null,
        arquivoCopiaNome: null,
        arquivoTriboId: null,
        arquivoErro: null,
      },
    });
  });
  return sincronizarFicha(fichaId, db, arquivos);
}

// Ficha excluída do sistema: original e cópia vão para a lixeira do OneDrive.
export async function apagarArquivosDaFicha(
  f: { arquivoDriveId: string | null; arquivoId: string | null; arquivoCopiaDriveId: string | null; arquivoCopiaId: string | null },
  arquivos: Arquivos,
) {
  if (f.arquivoId && f.arquivoDriveId) await arquivos.apagar({ driveId: f.arquivoDriveId, id: f.arquivoId });
  if (f.arquivoCopiaId && f.arquivoCopiaDriveId) await arquivos.apagar({ driveId: f.arquivoCopiaDriveId, id: f.arquivoCopiaId });
}

// Todas as fichas com arquivo de uma missão (depois do sorteio e no botão de sincronizar), uma de cada vez.
export async function sincronizarMissao(missaoId: number, db: Db, arquivos: Arquivos) {
  const fichas = await db.neocampista.findMany({
    where: { missaoId, NOT: { arquivoId: null } },
    select: { id: true },
    orderBy: { numero: "asc" },
  });
  let ok = 0;
  const falhas: number[] = [];
  for (const { id } of fichas) {
    const r = await sincronizarFicha(id, db, arquivos);
    if (r.ok) ok++;
    else falhas.push(id);
  }
  return { total: fichas.length, ok, falhas };
}
