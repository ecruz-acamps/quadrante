import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import type { Arquivos } from "./oneDrive";
import { criarZip, caminhoNoZip } from "./zipStream";
import { entradasFichasPorTribo, NOME_FALTARAM, nomeZip, type FichaParaZip } from "./fichasPorTribo";

async function zipEmBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

// OneDrive falso: o conteúdo de cada arquivo é o próprio itemId; "ruim" falha
const od = {
  baixar: async (ref: { id: string }) => {
    if (ref.id === "ruim") throw new Error("OneDrive: falha ao baixar o arquivo (404 itemNotFound)");
    return Buffer.from(`conteudo-${ref.id}`);
  },
} as unknown as Arquivos;

const fichas: FichaParaZip[] = [
  { numero: 50, nome: "Sem Tribo", tribo: null, arquivos: [{ nome: "050 - Sem Tribo.pdf", driveId: "d", itemId: "s1" }] },
  { numero: 12, nome: "Maria", tribo: { nome: "TRIBO VERDE" }, arquivos: [
    { nome: "012 - Maria - VERDE (1).pdf", driveId: "d", itemId: "m1" },
    { nome: "012 - Maria - VERDE (2).jpg", driveId: "d", itemId: "m2" },
  ] },
  { numero: 7, nome: "Ana Sênior", tribo: { nome: "TRIBO AZUL" }, arquivos: [
    { nome: "007 - Ana Sênior - AZUL.pdf", driveId: "d", itemId: "a1" },
    { nome: "007 - Ana Sênior - AZUL (falta).pdf", driveId: "d", itemId: "ruim" },
  ] },
];

test("zip com uma pasta por cor (SEM TRIBO no fim), nomes com acento e conteúdo certo; o que falhou vira LEIA-ME", async () => {
  const buf = await zipEmBuffer(criarZip(entradasFichasPorTribo(fichas, od)));
  const zip = await JSZip.loadAsync(buf);
  const nomes = Object.keys(zip.files);
  assert.deepEqual(nomes, [
    "AZUL/007 - Ana Sênior - AZUL.pdf",
    "VERDE/012 - Maria - VERDE (1).pdf",
    "VERDE/012 - Maria - VERDE (2).jpg",
    "SEM TRIBO/050 - Sem Tribo.pdf",
    NOME_FALTARAM,
  ]);
  assert.equal(await zip.file("VERDE/012 - Maria - VERDE (2).jpg")!.async("string"), "conteudo-m2");
  assert.match(await zip.file(NOME_FALTARAM)!.async("string"), /AZUL\/007 - Ana Sênior - AZUL \(falta\)\.pdf: OneDrive: falha/);
});

test("o zip passa na conferência do unzip (CRC e estrutura)", async (t) => {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
  } catch {
    t.skip("unzip não instalado");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "qd-zip-"));
  try {
    const arq = join(dir, "t.zip");
    writeFileSync(arq, await zipEmBuffer(criarZip(entradasFichasPorTribo(fichas, od))));
    const saida = execFileSync("unzip", ["-t", arq], { encoding: "utf8" });
    assert.match(saida, /No errors detected/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("caminhoNoZip e nomeZip", () => {
  assert.equal(caminhoNoZip("AZUL", "../a/b:c.pdf"), "AZUL/.. a b c.pdf");
  assert.equal(caminhoNoZip("SEM TRIBO", ".."), "SEM TRIBO/_");
  assert.equal(nomeZip("23º Acampamento Sênior"), "fichas-por-tribo-23-acampamento-senior.zip");
});
