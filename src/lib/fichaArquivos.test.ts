import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Arquivos, Item, Ref } from "./oneDrive";
import { nomeSeguro } from "./oneDrive";
import { corDaTribo, extensaoDe, nomeArquivoFicha } from "./fichaArquivos";

// ---------- nomes ----------

test("nomeArquivoFicha: número com 3 dígitos, nome e cor da tribo", () => {
  assert.equal(nomeArquivoFicha(12, " Maria  da Silva ", null, ".pdf"), "012 - Maria da Silva.pdf");
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

test("upload: vai com o nome original e é renomeado para número + nome", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(12, "Maria da Silva");
  const nomes: string[] = [];
  const espiao: Arquivos = { ...od, garantirPasta: od.garantirPasta.bind(od), listar: od.listar.bind(od), baixar: od.baixar.bind(od), apagar: od.apagar.bind(od),
    enviar: (p, n, c, s) => { nomes.push(`enviar:${n}`); return od.enviar(p, n, c, s); },
    renomear: (r, n) => { nomes.push(`renomear:${n}`); return od.renomear(r, n); } };
  const r = await m.enviarFichaPreenchida(id, "Scan_0001.PDF", Buffer.from("pdf"), db, espiao);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(nomes, ["enviar:Scan_0001.PDF", "renomear:012 - Maria da Silva.pdf"]);
  assert.deepEqual(od.arquivos(), ["Quadrante/23º Sênior/Fichas/012 - Maria da Silva.pdf"]);
  const f = await db.neocampista.findUniqueOrThrow({ where: { id } });
  assert.equal(f.arquivoNome, "012 - Maria da Silva.pdf");
  assert.equal(f.arquivoErro, null);
});

test("tribo: copia para a pasta da cor, troca de tribo move a cópia e renomeia", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(7, "João");
  await m.enviarFichaPreenchida(id, "foto.jpg", Buffer.from("jpg"), db, od);

  // sorteio: entra na AZUL
  await db.neocampista.update({ where: { id }, data: { triboId: t.azul } });
  assert.deepEqual(await m.sincronizarFicha(id, db, od), { ok: true });
  assert.deepEqual(od.arquivos(), [
    "Quadrante/23º Sênior/Fichas/007 - João - AZUL.jpg",
    "Quadrante/23º Sênior/Tribos/AZUL/007 - João - AZUL.jpg",
  ]);

  // rodar de novo não duplica nada
  await m.sincronizarFicha(id, db, od);
  assert.equal(od.arquivos().length, 2);

  // mudou para a VERDE antes da missão: sai da AZUL e entra na VERDE
  await db.neocampista.update({ where: { id }, data: { triboId: t.verde } });
  await m.sincronizarFicha(id, db, od);
  assert.deepEqual(od.arquivos(), [
    "Quadrante/23º Sênior/Fichas/007 - João - VERDE.jpg",
    "Quadrante/23º Sênior/Tribos/VERDE/007 - João - VERDE.jpg",
  ]);

  // ficou sem tribo: a cópia sai e o nome perde a cor
  await db.neocampista.update({ where: { id }, data: { triboId: null } });
  await m.sincronizarFicha(id, db, od);
  assert.deepEqual(od.arquivos(), ["Quadrante/23º Sênior/Fichas/007 - João.jpg"]);
});

test("mudou o nome na ficha: original e cópia são renomeados", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(30, "Ana");
  await db.neocampista.update({ where: { id }, data: { triboId: t.azul } });
  await m.enviarFichaPreenchida(id, "a.pdf", Buffer.from("x"), db, od);
  await db.neocampista.update({ where: { id }, data: { nome: "Ana Paula" } });
  await m.sincronizarFicha(id, db, od);
  assert.deepEqual(od.arquivos(), [
    "Quadrante/23º Sênior/Fichas/030 - Ana Paula - AZUL.pdf",
    "Quadrante/23º Sênior/Tribos/AZUL/030 - Ana Paula - AZUL.pdf",
  ]);
});

test("falha no OneDrive: grava o erro na ficha e a próxima sincronização corrige", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(40, "Beto");
  await m.enviarFichaPreenchida(id, "b.pdf", Buffer.from("x"), db, od);
  await db.neocampista.update({ where: { id }, data: { triboId: t.verde } });
  od.falharEnvio = true;
  const r = await m.sincronizarFicha(id, db, od);
  assert.equal(r.ok, false);
  assert.match((await db.neocampista.findUniqueOrThrow({ where: { id } })).arquivoErro ?? "", /fora do ar/);
  od.falharEnvio = false;
  const resumo = await m.sincronizarMissao(t.missao, db, od);
  assert.equal(resumo.falhas.length, 0);
  assert.equal((await db.neocampista.findUniqueOrThrow({ where: { id } })).arquivoErro, null);
  assert.ok(od.arquivos().includes("Quadrante/23º Sênior/Tribos/VERDE/040 - Beto - VERDE.pdf"));
});

test("trocar o arquivo: o anterior e a cópia vão para a lixeira", async () => {
  const od = new OneDriveFalso();
  const id = await novaFicha(50, "Caio");
  await db.neocampista.update({ where: { id }, data: { triboId: t.azul } });
  await m.enviarFichaPreenchida(id, "v1.pdf", Buffer.from("1"), db, od);
  await m.enviarFichaPreenchida(id, "v2.png", Buffer.from("22"), db, od);
  assert.deepEqual(od.arquivos(), [
    "Quadrante/23º Sênior/Fichas/050 - Caio - AZUL.png",
    "Quadrante/23º Sênior/Tribos/AZUL/050 - Caio - AZUL.png",
  ]);
});
