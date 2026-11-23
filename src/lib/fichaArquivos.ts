// Ficha preenchida no OneDrive: um ou mais arquivos por ficha (páginas, fotos).
//
// Na pasta raiz (ver src/lib/oneDrive.ts):
//   <Missão>/Fichas/012 - Maria da Silva - AZUL (1).pdf         todos os arquivos (os originais)
//   <Missão>/Fichas/012 - Maria da Silva - AZUL (2).jpg
//   <Missão>/Tribos/AZUL/012 - Maria da Silva - AZUL (1).pdf    cópias na pasta da cor da tribo
//
// - Nome: "NNN - Nome[ - COR]"; com mais de um arquivo, " (1)", " (2)"… na ordem de envio.
// - O upload vai com o nome original e em seguida é renomeado.
// - Com tribo (sorteio ou troca manual), cada arquivo ganha uma cópia na pasta da cor. Trocou de tribo: as cópias
//   saem da pasta antiga (lixeira do OneDrive) e entram na nova; os nomes passam a trazer a cor nova.
// - Removeu um arquivo: os outros são renumerados.
//
// sincronizarFicha compara o que está gravado com o que deveria estar e faz só o que falta, então pode ser chamada
// de novo depois de uma falha ("Tentar de novo", "Sincronizar com o OneDrive" em Tribos) sem duplicar nada.
import type { PrismaClient } from "@prisma/client";
import type { Arquivos } from "./oneDrive";

export const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB por arquivo (o proxy do Next limita o corpo do envio a 10 MB)
export const EXTENSOES = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".webp", ".doc", ".docx"];

export function corDaTribo(nomeTribo: string): string {
  return nomeTribo.replace(/^\s*tribo\s+/i, "").trim().toUpperCase();
}

export function extensaoDe(nomeArquivo: string): string {
  const m = /\.[A-Za-z0-9]{1,8}$/.exec(nomeArquivo.trim());
  return m ? m[0].toLowerCase() : "";
}

// parte: posição do arquivo quando a ficha tem mais de um (null = arquivo único, sem número)
export function nomeArquivoFicha(numero: number, nome: string, tribo: string | null, ext: string, parte: number | null = null): string {
  const partes = [String(numero).padStart(3, "0"), nome.trim().replace(/\s+/g, " ")];
  if (tribo) partes.push(corDaTribo(tribo));
  return `${partes.join(" - ")}${parte != null ? ` (${parte})` : ""}${ext}`;
}

export function caminhoFichas(missaoNome: string) {
  return [missaoNome, "Fichas"];
}

export function caminhoTribo(missaoNome: string, nomeTribo: string) {
  return [missaoNome, "Tribos", corDaTribo(nomeTribo)];
}

type Db = Pick<PrismaClient, "neocampista" | "fichaArquivo">;

// uma operação por ficha de cada vez (sorteio em segundo plano + upload + troca manual ao mesmo tempo)
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

async function registrar(fichaId: number, db: Db, tarefa: () => Promise<void>): Promise<ResultadoSync> {
  try {
    await tarefa();
    await db.neocampista.updateMany({ where: { id: fichaId, NOT: { arquivoErro: null } }, data: { arquivoErro: null } });
    return { ok: true };
  } catch (e) {
    const erro = mensagem(e);
    await db.neocampista.updateMany({ where: { id: fichaId }, data: { arquivoErro: erro } }).catch(() => {});
    return { ok: false, erro };
  }
}

export function sincronizarFicha(fichaId: number, db: Db, arquivos: Arquivos): Promise<ResultadoSync> {
  return emFila(fichaId, () => registrar(fichaId, db, () => sincronizarAgora(fichaId, db, arquivos)));
}

async function sincronizarAgora(fichaId: number, db: Db, od: Arquivos) {
  const f = await db.neocampista.findUnique({
    where: { id: fichaId },
    include: {
      tribo: { select: { id: true, nome: true } },
      missao: { select: { nome: true } },
      arquivos: { orderBy: [{ ordem: "asc" }, { id: "asc" }] },
    },
  });
  if (!f || f.arquivos.length === 0) return;
  const varios = f.arquivos.length > 1;

  for (const [i, a] of f.arquivos.entries()) {
    const ordem = i + 1;
    const desejado = nomeArquivoFicha(f.numero, f.nome, f.tribo?.nome ?? null, a.ext, varios ? ordem : null);
    if (a.ordem !== ordem) await db.fichaArquivo.update({ where: { id: a.id }, data: { ordem } });

    // 1. nome do original
    if (a.nome !== desejado) {
      const r = await od.renomear({ driveId: a.driveId, id: a.itemId }, desejado);
      await db.fichaArquivo.update({ where: { id: a.id }, data: { nome: r.name, url: r.webUrl ?? a.url } });
    }

    // 2. cópia na pasta da tribo
    const copia = a.copiaItemId && a.copiaDriveId ? { driveId: a.copiaDriveId, id: a.copiaItemId } : null;
    const triboCerta = copia && a.copiaTriboId === (f.tribo?.id ?? null);

    if (copia && !triboCerta) {
      await od.apagar(copia); // saiu da tribo antiga (ou ficou sem tribo)
      await db.fichaArquivo.update({
        where: { id: a.id },
        data: { copiaDriveId: null, copiaItemId: null, copiaNome: null, copiaTriboId: null },
      });
    }

    if (f.tribo && !triboCerta) {
      const pasta = await od.garantirPasta(caminhoTribo(f.missao.nome, f.tribo.nome));
      const conteudo = await od.baixar({ driveId: a.driveId, id: a.itemId });
      const nova = await od.enviar(pasta, desejado, conteudo, "replace");
      await db.fichaArquivo.update({
        where: { id: a.id },
        data: { copiaDriveId: nova.driveId, copiaItemId: nova.id, copiaNome: nova.name, copiaTriboId: f.tribo.id },
      });
    } else if (f.tribo && copia && a.copiaNome !== desejado) {
      // mesma tribo, mas mudou o nome, o número da ficha ou a posição do arquivo
      const r = await od.renomear(copia, desejado);
      await db.fichaArquivo.update({ where: { id: a.id }, data: { copiaNome: r.name } });
    }
  }
}

// Mais um arquivo da ficha preenchida: envia com o nome original e depois sincroniza (renomeia todos e copia).
export async function enviarFichaPreenchida(
  fichaId: number,
  nomeOriginal: string,
  conteudo: Buffer,
  db: Db,
  od: Arquivos,
): Promise<ResultadoSync> {
  const f = await db.neocampista.findUniqueOrThrow({ where: { id: fichaId }, include: { missao: { select: { nome: true } } } });
  await emFila(fichaId, async () => {
    const pasta = await od.garantirPasta(caminhoFichas(f.missao.nome));
    const item = await od.enviar(pasta, nomeOriginal, conteudo, "rename");
    const ultimo = await db.fichaArquivo.findFirst({ where: { neocampistaId: fichaId }, orderBy: { ordem: "desc" }, select: { ordem: true } });
    await db.fichaArquivo.create({
      data: {
        neocampistaId: fichaId,
        ordem: (ultimo?.ordem ?? 0) + 1,
        ext: extensaoDe(nomeOriginal),
        driveId: item.driveId,
        itemId: item.id,
        nome: item.name,
        url: item.webUrl ?? null,
      },
    });
  });
  return sincronizarFicha(fichaId, db, od);
}

// Tira um arquivo da ficha: original e cópia vão para a lixeira do OneDrive e os outros são renumerados.
export async function removerArquivoFicha(arquivoId: number, db: Db, od: Arquivos): Promise<ResultadoSync> {
  const a = await db.fichaArquivo.findUniqueOrThrow({ where: { id: arquivoId } });
  return emFila(a.neocampistaId, () =>
    registrar(a.neocampistaId, db, async () => {
      await od.apagar({ driveId: a.driveId, id: a.itemId });
      if (a.copiaItemId && a.copiaDriveId) await od.apagar({ driveId: a.copiaDriveId, id: a.copiaItemId });
      await db.fichaArquivo.delete({ where: { id: a.id } });
      await sincronizarAgora(a.neocampistaId, db, od);
    }),
  );
}

type ArquivoGravado = { driveId: string; itemId: string; copiaDriveId: string | null; copiaItemId: string | null };

// Ficha excluída do sistema: originais e cópias vão para a lixeira do OneDrive.
export async function apagarArquivosDaFicha(lista: ArquivoGravado[], od: Arquivos) {
  for (const a of lista) {
    await od.apagar({ driveId: a.driveId, id: a.itemId });
    if (a.copiaItemId && a.copiaDriveId) await od.apagar({ driveId: a.copiaDriveId, id: a.copiaItemId });
  }
}

// Todas as fichas com arquivo de uma missão (depois do sorteio e no botão de sincronizar), uma de cada vez.
export async function sincronizarMissao(missaoId: number, db: Db, od: Arquivos) {
  const fichas = await db.neocampista.findMany({
    where: { missaoId, arquivos: { some: {} } },
    select: { id: true },
    orderBy: { numero: "asc" },
  });
  let ok = 0;
  const falhas: number[] = [];
  for (const { id } of fichas) {
    const r = await sincronizarFicha(id, db, od);
    if (r.ok) ok++;
    else falhas.push(id);
  }
  return { total: fichas.length, ok, falhas };
}
