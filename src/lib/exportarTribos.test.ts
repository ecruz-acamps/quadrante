import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { nomeArquivoTribos, planilhaTribos } from "./exportarTribos";

async function reler(wb: ExcelJS.Workbook) {
  const lido = new ExcelJS.Workbook();
  await lido.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  return lido;
}

test("uma folha por tribo com campistas, na cor da tribo; lista em ordem alfabética com telefone formatado", async () => {
  const wb = await reler(
    planilhaTribos("23º Acampamento Sênior", [
      { nome: "TRIBO AZUL", campistas: [
        { numero: 31, nome: "Bruno Alves", celular: "48988451022" },
        { numero: 7, nome: "Ana Costa", celular: "(48) 9 9123-4567" },
        { numero: 27, nome: "Felipe Rocha", celular: null },
      ] },
      { nome: "TRIBO VERDE", campistas: [{ numero: 3, nome: "Élida Lima", celular: "4832221100" }] },
      { nome: "TRIBO ROXA", campistas: [] },
    ]),
  );
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["AZUL", "VERDE"]); // tribo vazia não gera folha
  const azul = wb.getWorksheet("AZUL")!;
  assert.equal(azul.getCell("A1").value, "TRIBO AZUL");
  assert.equal(azul.getCell("A2").value, "23º Acampamento Sênior · 3 campistas");
  assert.deepEqual(azul.getRow(3).values, [, "Nº", "NOME", "TELEFONE"]);
  const linhas = [4, 5, 6].map((r) => (azul.getRow(r).values as unknown[]).slice(1));
  assert.deepEqual(linhas, [
    [7, "Ana Costa", "(48) 99123-4567"],
    [31, "Bruno Alves", "(48) 98845-1022"],
    [27, "Felipe Rocha", ""],
  ]);
  assert.equal(azul.properties.tabColor?.argb, "FF2255A4");
  assert.equal(azul.pageSetup.fitToPage, true);
  assert.equal(wb.getWorksheet("VERDE")!.getCell("C4").value, "(48) 3222-1100");
});

test("sem campistas em nenhuma tribo: uma folha com aviso; nome do arquivo sem acentos", async () => {
  const wb = await reler(planilhaTribos("M", [{ nome: "TRIBO AZUL", campistas: [] }]));
  assert.equal(wb.worksheets.length, 1);
  assert.match(String(wb.worksheets[0].getCell("A1").value), /nenhuma tribo/);
  assert.equal(nomeArquivoTribos("23º Acampamento Sênior"), "tribos-23-acampamento-senior.xlsx");
});
