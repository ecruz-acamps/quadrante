import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Arquivos, Item, Ref } from "./oneDrive";
import { nomeSeguro } from "./oneDrive";
import { corDaTribo, extensaoDe, nomeArquivoFicha } from "./fichaArquivos";
import { contarPaginas } from "./pdfFicha";
import { PDFDocument } from "pdf-lib";

// fotos de verdade (geradas por um canvas do Chromium, como o navegador faz no envio) e PDFs de N páginas
const foto = (n: "retrato" | "paisagem") => readFileSync(join(__dirname, "__fixtures__", `foto-${n}.jpg`));
async function pdfDe(paginas: number) {
  const d = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) d.addPage();
  return Buffer.from(await d.save());
}

// ---------- nomes ----------

test("nomeArquivoFicha: número com 3 dígitos, nome, cor da tribo e posição quando há vários", () => {
  assert.equal(nomeArquivoFicha(12, " Maria  da Silva ", null, ".pdf"), "012 - Maria da Silva.pdf");
  assert.equal(nomeArquivoFicha(12, "Maria", "TRIBO AZUL", ".pdf", 2), "012 - Maria - AZUL (2).pdf");
  assert.equal(nomeArquivoFicha(7, "João", "TRIBO AZUL", ".jpg"), "007 - João - AZUL.jpg");
  assert.equal(nomeArquivoFicha(123, "Ana", "Tribo Vermelha", ""), "123 - Ana - VERMELHA");
});

test("corDaTribo e extensaoDe", () => {
  assert.equal(corDaTribo("TRIBO AMARELA"), "AMARELA");
  assert.equal(corDaTribo("Azul"), "AZUL");
  assert.equal(extensaoDe("Scan 01.PDF"), ".pdf");
  assert.equal(extensaoDe("sem-extensao"), "");
});

test("nomeSeguro: tira caracteres que o OneDrive recusa", () => {
  assert.equal(nomeSeguro('012 - Ana "Nina": A/B?.pdf'), "012 - Ana Nina A B .pdf");
  assert.equal(nomeSeguro("pasta. "), "pasta");
  assert.equal(nomeSeguro("CON"), "_CON");
  assert.equal(nomeSeguro("23º Acampamento Sênior"), "23º Acampamento Sênior");
});

// ---------- sincronização (OneDrive em memória + banco temporário) ----------

type No = { id: string; nome: string; pai: string | null; pasta: boolean; conteudo?: Buffer; apagado?: boolean };

class OneDriveFalso implements Arquivos {
  nos = new Map<string, No>();
  seq = 0;
  falharEnvio = false;
  constructor() {
    this.nos.set("raiz", { id: "raiz", nome: "Quadrante", pai: null, pasta: true });
  }
  private novo(n: Omit<No, "id">) {
    const id = `i${++this.seq}`;
    this.nos.set(id, { id, ...n });
    return id;
  }
  private filhos(pai: string) {
    return [...this.nos.values()].filter((n) => n.pai === pai && !n.apagado);
  }
  private item(id: string): Item {
    const n = this.nos.get(id)!;
    return { driveId: "d", id, name: n.nome, webUrl: `https://x/${id}`, size: n.conteudo?.length };
  }
  caminho(id: string): string {
    const n = this.nos.get(id)!;
    return n.pai ? `${this.caminho(n.pai)}/${n.nome}` : n.nome;
  }
  // arquivos não apagados, por caminho completo
  arquivos(): string[] {
    return [...this.nos.values()].filter((n) => !n.pasta && !n.apagado).map((n) => this.caminho(n.id)).sort();
  }
  async garantirPasta(caminho: string[]): Promise<Ref> {
    let atual = "raiz";
    for (const parte of caminho) {
      const existe = this.filhos(atual).find((n) => n.pasta && n.nome === nomeSeguro(parte));
      atual = existe ? existe.id : this.novo({ nome: nomeSeguro(parte), pai: atual, pasta: true });
    }
    return { driveId: "d", id: atual };
  }
  async listar(pasta: Ref) {
    return this.filhos(pasta.id).map((n) => this.item(n.id));
  }
  async enviar(pasta: Ref, nome: string, conteudo: Buffer, seExistir: "rename" | "replace") {
    if (this.falharEnvio) throw new Error("OneDrive fora do ar");
    const existente = this.filhos(pasta.id).find((n) => n.nome === nome);
    if (existente && seExistir === "replace") {
      existente.conteudo = conteudo;
      return this.item(existente.id);
    }
    const nomeFinal = existente ? `${nome} 1` : nome;
    return this.item(this.novo({ nome: nomeFinal, pai: pasta.id, pasta: false, conteudo }));
  }
  async renomear(ref: Ref, nome: string) {
    this.nos.get(ref.id)!.nome = nome;
    return this.item(ref.id);
  }
  async baixar(ref: Ref) {
    return this.nos.get(ref.id)!.conteudo!;
  }
  async substituir(ref: Ref, conteudo: Buffer) {
    if (this.falharEnvio) throw new Error("OneDrive fora do ar");
    this.nos.get(ref.id)!.conteudo = conteudo;
    return this.item(ref.id);
  }
  // páginas do PDF guardado em um caminho
  async paginas(caminho: string) {
    const n = [...this.nos.values()].find((x) => !x.apagado && this.caminho(x.id) === caminho);
    return n?.conteudo ? contarPaginas(n.conteudo) : -1;
  }
  async apagar(ref: Ref) {
    const n = this.nos.get(ref.id);
    if (n) n.apagado = true;
  }
}

const dir = mkdtempSync(join(tmpdir(), "qd-fichaarq-"));
process.env.DATABASE_URL = `file:${join(dir, "teste.db")}`;
type Db = typeof import("./db").db;
let db: Db;
let m: typeof import("./fichaArquivos");
const t: Record<string, number> = {};

before(async () => {
  execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  db = (await import("./db")).db;
  m = await import("./fichaArquivos");
  const missao = await db.missao.create({ data: { nome: "23º Sênior", tipo: "SENIOR", ano: 2026, cercoSlug: "s23" } });
  t.missao = missao.id;
  t.azul = (await db.tribo.create({ data: { missaoId: missao.id, nome: "TRIBO AZUL" } })).id;
  t.verde = (await db.tribo.create({ data: { missaoId: missao.id, nome: "TRIBO VERDE" } })).id;
});

after(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

async function novaFicha(numero: number, nome: string) {
  return (await db.neocampista.create({ data: { missaoId: t.missao, numero, nucleo: "N", nome } })).id;
}

const F = "Quadrante/23º Sênior/Fichas";
const T = (cor: string) => `Quadrante/23º Sênior/Tribos/${cor}`;

test("duas fotos viram um PDF único de 2 páginas, com o nome da ficha", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(12, "Maria da Silva");
  assert.deepEqual(await m.enviarFichaPreenchida(id, "IMG_frente.jpg", foto("retrato"), db, od), { ok: true });
  assert.deepEqual(od.arquivos(), [`${F}/012 - Maria da Silva.pdf`]);
  const [antes] = await db.fichaArquivo.findMany({ where: { neocampistaId: id } });

  await m.enviarFichaPreenchida(id, "IMG_verso.jpg", foto("paisagem"), db, od);
  assert.deepEqual(od.arquivos(), [`${F}/012 - Maria da Silva.pdf`]); // continua um arquivo só
  assert.equal(await od.paginas(`${F}/012 - Maria da Silva.pdf`), 2);
  const [depois] = await db.fichaArquivo.findMany({ where: { neocampistaId: id } });
  assert.equal(depois.itemId, antes.itemId); // mesmo arquivo (e link) no OneDrive
  assert.deepEqual(m.lerPartes(depois.partes), [
    { nome: "IMG_frente.jpg", paginas: 1 },
    { nome: "IMG_verso.jpg", paginas: 1 },
  ]);
  assert.equal((await db.neocampista.findUniqueOrThrow({ where: { id } })).arquivoErro, null);
});

test("PDF enviado entra com todas as páginas; formato não aceito é recusado", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(13, "Joana");
  await m.enviarFichaPreenchida(id, "scan.pdf", await pdfDe(2), db, od);
  await m.enviarFichaPreenchida(id, "foto.jpg", foto("retrato"), db, od);
  assert.equal(await od.paginas(`${F}/013 - Joana.pdf`), 3);
  await assert.rejects(m.enviarFichaPreenchida(id, "ficha.docx", Buffer.from("x"), db, od), /Formato não aceito/);
});

test("tribo: o PDF ganha cópia na pasta da cor; troca de tribo move a cópia e renomeia", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(7, "João");
  await m.enviarFichaPreenchida(id, "a.jpg", foto("retrato"), db, od);
  await m.enviarFichaPreenchida(id, "b.jpg", foto("retrato"), db, od);

  await db.neocampista.update({ where: { id }, data: { triboId: t.azul } });
  assert.deepEqual(await m.sincronizarFicha(id, db, od), { ok: true });
  assert.deepEqual(od.arquivos(), [`${F}/007 - João - AZUL.pdf`, `${T("AZUL")}/007 - João - AZUL.pdf`]);
  assert.equal(await od.paginas(`${T("AZUL")}/007 - João - AZUL.pdf`), 2);

  await m.sincronizarFicha(id, db, od); // de novo: nada duplica
  assert.equal(od.arquivos().length, 2);

  await db.neocampista.update({ where: { id }, data: { triboId: t.verde } });
  await m.sincronizarFicha(id, db, od);
  assert.deepEqual(od.arquivos(), [`${F}/007 - João - VERDE.pdf`, `${T("VERDE")}/007 - João - VERDE.pdf`]);

  await db.neocampista.update({ where: { id }, data: { triboId: null } });
  await m.sincronizarFicha(id, db, od);
  assert.deepEqual(od.arquivos(), [`${F}/007 - João.pdf`]);
});

test("foto acrescentada depois do sorteio: a cópia da tribo é refeita com as páginas novas", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(8, "Lia");
  await db.neocampista.update({ where: { id }, data: { triboId: t.azul } });
  await m.enviarFichaPreenchida(id, "frente.jpg", foto("retrato"), db, od);
  assert.equal(await od.paginas(`${T("AZUL")}/008 - Lia - AZUL.pdf`), 1);
  await m.enviarFichaPreenchida(id, "verso.jpg", foto("retrato"), db, od);
  assert.deepEqual(od.arquivos(), [`${F}/008 - Lia - AZUL.pdf`, `${T("AZUL")}/008 - Lia - AZUL.pdf`]);
  assert.equal(await od.paginas(`${T("AZUL")}/008 - Lia - AZUL.pdf`), 2);
});

test("mudou o nome na ficha: PDF e cópia são renomeados", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(30, "Ana");
  await db.neocampista.update({ where: { id }, data: { triboId: t.azul } });
  await m.enviarFichaPreenchida(id, "a.jpg", foto("retrato"), db, od);
  await db.neocampista.update({ where: { id }, data: { nome: "Ana Paula" } });
  await m.sincronizarFicha(id, db, od);
  assert.deepEqual(od.arquivos(), [`${F}/030 - Ana Paula - AZUL.pdf`, `${T("AZUL")}/030 - Ana Paula - AZUL.pdf`]);
});

test("falha no OneDrive: grava o erro na ficha e a próxima sincronização corrige", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(40, "Beto");
  await m.enviarFichaPreenchida(id, "b.jpg", foto("retrato"), db, od);
  await db.neocampista.update({ where: { id }, data: { triboId: t.verde } });
  od.falharEnvio = true;
  const r = await m.sincronizarFicha(id, db, od);
  assert.equal(r.ok, false);
  assert.match((await db.neocampista.findUniqueOrThrow({ where: { id } })).arquivoErro ?? "", /fora do ar/);
  od.falharEnvio = false;
  const resumo = await m.sincronizarMissao(t.missao, db, od);
  assert.equal(resumo.falhas.length, 0);
  assert.equal((await db.neocampista.findUniqueOrThrow({ where: { id } })).arquivoErro, null);
  assert.ok(od.arquivos().includes(`${T("VERDE")}/040 - Beto - VERDE.pdf`));
});

test("remover uma parte tira só as páginas dela; a última parte leva o PDF para a lixeira", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(60, "Dora");
  await db.neocampista.update({ where: { id }, data: { triboId: t.azul } });
  await m.enviarFichaPreenchida(id, "frente.jpg", foto("retrato"), db, od);
  await m.enviarFichaPreenchida(id, "anexo.pdf", await pdfDe(2), db, od);
  await m.enviarFichaPreenchida(id, "verso.jpg", foto("paisagem"), db, od);
  const [a] = await db.fichaArquivo.findMany({ where: { neocampistaId: id } });
  assert.equal(await od.paginas(`${F}/060 - Dora - AZUL.pdf`), 4);

  assert.deepEqual(await m.removerParteFicha(a.id, 1, db, od), { ok: true }); // tira o anexo de 2 páginas
  assert.equal(await od.paginas(`${F}/060 - Dora - AZUL.pdf`), 2);
  assert.equal(await od.paginas(`${T("AZUL")}/060 - Dora - AZUL.pdf`), 2); // cópia refeita
  const [b] = await db.fichaArquivo.findMany({ where: { neocampistaId: id } });
  assert.deepEqual(m.lerPartes(b.partes).map((p) => p.nome), ["frente.jpg", "verso.jpg"]);

  await m.removerParteFicha(b.id, 0, db, od);
  await m.removerParteFicha(b.id, 0, db, od);
  assert.deepEqual(od.arquivos(), []);
  assert.equal(await db.fichaArquivo.count({ where: { neocampistaId: id } }), 0);
});

test("arquivos soltos de antes do PDF único: PDF/JPG entram no PDF no próximo envio; o resto fica separado", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(70, "Eva");
  const pasta = await od.garantirPasta(["23º Sênior", "Fichas"]);
  const solto = async (nome: string, conteudo: Buffer, ext: string, ordem: number) => {
    const it = await od.enviar(pasta, nome, conteudo, "rename");
    await db.fichaArquivo.create({ data: { neocampistaId: id, ordem, ext, driveId: it.driveId, itemId: it.id, nome: it.name } });
  };
  await solto("070 - Eva (1).jpg", foto("retrato"), ".jpg", 1);
  await solto("070 - Eva (2).docx", Buffer.from("word"), ".docx", 2);

  await m.enviarFichaPreenchida(id, "verso.jpg", foto("retrato"), db, od);
  assert.deepEqual(od.arquivos(), [`${F}/070 - Eva (1).pdf`, `${F}/070 - Eva (2).docx`]);
  assert.equal(await od.paginas(`${F}/070 - Eva (1).pdf`), 2);
});

test("excluir a ficha: PDF e cópia vão para a lixeira", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(71, "Ivo");
  await db.neocampista.update({ where: { id }, data: { triboId: t.azul } });
  await m.enviarFichaPreenchida(id, "a.jpg", foto("retrato"), db, od);
  await m.apagarArquivosDaFicha(await db.fichaArquivo.findMany({ where: { neocampistaId: id } }), od);
  assert.deepEqual(od.arquivos(), []);
});

test("OneDrive recusando (ex.: segredo vencido): o envio falha com o motivo e NÃO deixa erro solto que derruba o servidor", async () => {
  const soltos: unknown[] = [];
  const pegar = (e: unknown) => soltos.push(e);
  process.on("unhandledRejection", pegar);
  try {
    const od = new OneDriveFalso();
    od.falharEnvio = true;
    const id = await novaFicha(90, "Claudoir");
    await assert.rejects(m.enviarFichaPreenchida(id, "Claudoir 1.jpg", foto("retrato"), db, od), /fora do ar/);
    await new Promise((r) => setTimeout(r, 50)); // dá tempo de um erro solto aparecer
    assert.equal(soltos.length, 0, `erro solto: ${String(soltos[0])}`);
    // a fila da ficha continua funcionando depois da falha
    od.falharEnvio = false;
    assert.deepEqual(await m.enviarFichaPreenchida(id, "Claudoir 1.jpg", foto("retrato"), db, od), { ok: true });
  } finally {
    process.off("unhandledRejection", pegar);
  }
});

// ---------- comprovante do PIX ----------

test("regra do PIX: sem comprovante, OK vira PENDENTE; com comprovante ou outro pagamento, fica como está", async () => {
  const { situacaoPermitida } = await import("./comprovante");
  assert.equal(situacaoPermitida("PIX", "OK", false), "PENDENTE");
  assert.equal(situacaoPermitida("PIX", "OK", true), "OK");
  assert.equal(situacaoPermitida("DINHEIRO", "OK", false), "OK");
  assert.equal(situacaoPermitida("PIX", "CANCELADO", false), "CANCELADO");
  assert.equal(situacaoPermitida(null, "OK", false), "OK");
});

test("comprovante: vai para Comprovantes PIX no OneDrive, renomeado; trocar manda o anterior para a lixeira; remover volta para PENDENTE", async () => {
  const c = await import("./comprovante");
  const od = new OneDriveFalso();
  const id = await novaFicha(80, "Rita Souza");
  await db.neocampista.update({ where: { id }, data: { pagamento: "PIX", situacao: "PENDENTE" } });

  await c.enviarComprovante(id, "Comprovante_Nubank.PDF", Buffer.from("pix1"), db, od);
  assert.deepEqual(od.arquivos(), ["Quadrante/23º Sênior/Comprovantes PIX/080 - Rita Souza - PIX.pdf"]);
  // agora pode ficar OK
  await db.neocampista.update({ where: { id }, data: { situacao: "OK" } });

  await c.enviarComprovante(id, "foto.jpg", Buffer.from("pix2"), db, od);
  assert.deepEqual(od.arquivos(), ["Quadrante/23º Sênior/Comprovantes PIX/080 - Rita Souza - PIX.jpg"]);

  // mudou o nome na ficha: o comprovante acompanha
  const f = await db.neocampista.update({ where: { id }, data: { nome: "Rita de Souza" } });
  await c.renomearComprovante(f, db, od);
  assert.deepEqual(od.arquivos(), ["Quadrante/23º Sênior/Comprovantes PIX/080 - Rita de Souza - PIX.jpg"]);

  const depois = await c.removerComprovante(id, db, od);
  assert.deepEqual(od.arquivos(), []);
  assert.equal(depois.situacao, "PENDENTE");
  assert.equal(depois.comprovanteItemId, null);
});
