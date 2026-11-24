// Ficha preenchida no OneDrive: um PDF único por ficha (as fotos viram páginas A4; ver src/lib/pdfFicha.ts).
// Arquivos enviados antes do PDF único podem ainda estar soltos (um ou mais por ficha) e são juntados no próximo envio.
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
import { anexarAoPdf, removerPaginas, EXTENSOES_PDF_FICHA } from "./pdfFicha";

export const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB por arquivo (o proxy do Next limita o corpo do envio a 10 MB)
// fotos HEIC/WEBP são convertidas para JPG no navegador antes de subir; o servidor recebe PDF, JPG ou PNG
export const EXTENSOES = EXTENSOES_PDF_FICHA;

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
  // o que fica guardado na fila nunca falha: se guardasse `atual.finally(...)`, uma falha da tarefa (ex.: OneDrive
  // recusando) virava um erro solto ("unhandledRejection") que derrubava o servidor no meio do envio. Quem chamou
  // recebe a falha por `atual`, normalmente.
  const fim: Promise<void> = atual.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
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

export type Parte = { nome: string; paginas: number };

export function lerPartes(json: string | null | undefined): Parte[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((p): p is Parte => !!p && typeof p.nome === "string" && Number.isInteger(p.paginas)) : [];
  } catch {
    return [];
  }
}

// Mais um arquivo na ficha preenchida: entra no fim do PDF único da ficha (foto vira página A4; PDF entra com as
// páginas dele). Sem PDF ainda, cria um. Arquivos soltos de antes (PDF/JPG/PNG) são juntados no mesmo PDF.
// Depois sincroniza: nome "NNN - Nome[ - COR].pdf" e cópia na pasta da tribo (refeita, porque o conteúdo mudou).
export async function enviarFichaPreenchida(
  fichaId: number,
  nomeOriginal: string,
  conteudo: Buffer,
  db: Db,
  od: Arquivos,
): Promise<ResultadoSync> {
  const ext = extensaoDe(nomeOriginal);
  if (!EXTENSOES_PDF_FICHA.includes(ext)) throw new Error(`Formato não aceito: "${nomeOriginal}". Use foto (JPG/PNG) ou PDF.`);
  await emFila(fichaId, async () => {
    const f = await db.neocampista.findUniqueOrThrow({
      where: { id: fichaId },
      include: { missao: { select: { nome: true } }, arquivos: { orderBy: [{ ordem: "asc" }, { id: "asc" }] } },
    });
    const pdfAtual = f.arquivos.find((a) => a.partes != null) ?? null;
    const legados = f.arquivos.filter((a) => a.partes == null && EXTENSOES_PDF_FICHA.includes(a.ext));

    let base: Uint8Array | null = pdfAtual ? await od.baixar({ driveId: pdfAtual.driveId, id: pdfAtual.itemId }) : null;
    const partes = pdfAtual ? lerPartes(pdfAtual.partes) : [];
    for (const l of legados) {
      const r = await anexarAoPdf(base, { nome: l.nome, conteudo: await od.baixar({ driveId: l.driveId, id: l.itemId }), ext: l.ext });
      base = r.pdf;
      partes.push({ nome: l.nome, paginas: r.paginas });
    }
    const r = await anexarAoPdf(base, { nome: nomeOriginal, conteudo, ext });
    partes.push({ nome: nomeOriginal, paginas: r.paginas });
    const pdf = Buffer.from(r.pdf);

    if (pdfAtual) {
      await od.substituir({ driveId: pdfAtual.driveId, id: pdfAtual.itemId }, pdf);
      await refazerCopia(pdfAtual, db, od);
      await db.fichaArquivo.update({ where: { id: pdfAtual.id }, data: { partes: JSON.stringify(partes), ext: ".pdf" } });
    } else {
      // sobe com o nome do arquivo enviado (em .pdf) e a sincronização renomeia para "NNN - Nome"
      const pasta = await od.garantirPasta(caminhoFichas(f.missao.nome));
      const item = await od.enviar(pasta, `${nomeOriginal.replace(/\.[^.]+$/, "")}.pdf`, pdf, "rename");
      await db.fichaArquivo.create({
        data: {
          neocampistaId: fichaId,
          ordem: 0, // o PDF vem antes de arquivos antigos que não puderam ser juntados
          ext: ".pdf",
          driveId: item.driveId,
          itemId: item.id,
          nome: item.name,
          url: item.webUrl ?? null,
          partes: JSON.stringify(partes),
        },
      });
    }
    // os soltos que entraram no PDF (e as cópias deles) vão para a lixeira do OneDrive
    for (const l of legados) {
      await od.apagar({ driveId: l.driveId, id: l.itemId });
      if (l.copiaItemId && l.copiaDriveId) await od.apagar({ driveId: l.copiaDriveId, id: l.copiaItemId });
      await db.fichaArquivo.delete({ where: { id: l.id } });
    }
  });
  return sincronizarFicha(fichaId, db, od);
}

// o conteúdo do PDF mudou: a cópia da tribo sai e a sincronização faz outra
async function refazerCopia(
  a: { id: number; copiaDriveId: string | null; copiaItemId: string | null },
  db: Db,
  od: Arquivos,
) {
  if (!a.copiaItemId || !a.copiaDriveId) return;
  await od.apagar({ driveId: a.copiaDriveId, id: a.copiaItemId });
  await db.fichaArquivo.update({ where: { id: a.id }, data: { copiaDriveId: null, copiaItemId: null, copiaNome: null, copiaTriboId: null } });
}

// Tira uma parte (ex.: uma das fotos) do PDF da ficha. Se era a única, o PDF vai para a lixeira do OneDrive.
export async function removerParteFicha(arquivoId: number, indice: number, db: Db, od: Arquivos): Promise<ResultadoSync> {
  const a = await db.fichaArquivo.findUniqueOrThrow({ where: { id: arquivoId } });
  const partes = lerPartes(a.partes);
  if (!partes[indice]) throw new Error("Parte não encontrada.");
  return emFila(a.neocampistaId, () =>
    registrar(a.neocampistaId, db, async () => {
      const inicio = partes.slice(0, indice).reduce((n, p) => n + p.paginas, 0);
      const r = await removerPaginas(await od.baixar({ driveId: a.driveId, id: a.itemId }), inicio, partes[indice].paginas);
      if (!r) {
        await od.apagar({ driveId: a.driveId, id: a.itemId });
        if (a.copiaItemId && a.copiaDriveId) await od.apagar({ driveId: a.copiaDriveId, id: a.copiaItemId });
        await db.fichaArquivo.delete({ where: { id: a.id } });
      } else {
        await od.substituir({ driveId: a.driveId, id: a.itemId }, Buffer.from(r.pdf));
        await refazerCopia(a, db, od);
        partes.splice(indice, 1);
        await db.fichaArquivo.update({ where: { id: a.id }, data: { partes: JSON.stringify(partes) } });
      }
      await sincronizarAgora(a.neocampistaId, db, od);
    }),
  );
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
