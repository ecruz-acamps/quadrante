import { test } from "node:test";
import assert from "node:assert/strict";
import { planilhaEquipes, nomeArquivoEquipes } from "./exportarEquipes";

const equipes = [
  {
    nome: "Equipe 1",
    membros: [
      { nome: "Ana", celular: "48999990000", cidade: "PALHOÇA", temCarro: true },
      { nome: "Bia", celular: null, cidade: null, temCarro: false },
    ],
    casas: [{ numero: 12, nome: "Maria", endereco: "Rua A, 1", bairro: "Centro", cidade: "SÃO JOSÉ", celular: null }],
  },
  { nome: "Equipe 2", membros: [], casas: [] },
];

test("folha Equipes lista cada equipe com os integrantes", () => {
  const wb = planilhaEquipes("23º Acampamento", equipes);
  const ws = wb.getWorksheet("Equipes")!;
  const linhas = ws.getSheetValues().map((r) => (Array.isArray(r) ? r.slice(1).map((v) => v ?? "") : []));
  const texto = linhas.map((l) => l.join("|"));
  assert.ok(String(ws.getCell(2, 1).value).includes("2 equipes · 2 integrantes · 1 casa"));
  assert.ok(texto.some((t) => t.startsWith("Equipe 1 · 2 integrantes · 1 carro · 1 casa")));
  assert.ok(texto.some((t) => t.startsWith("Ana|") && t.includes("PALHOÇA") && t.endsWith("sim")));
  assert.ok(texto.some((t) => t.startsWith("Bia|")));
  assert.ok(texto.some((t) => t.startsWith("(sem integrantes)")));
});

test("folha Casas traz as casas da equipe", () => {
  const ws = planilhaEquipes("M", equipes).getWorksheet("Casas")!;
  const valores = ws.getSheetValues().flatMap((r) => (Array.isArray(r) ? r : [])).map(String);
  assert.ok(valores.includes("Maria"));
  assert.ok(valores.includes("Rua A, 1"));
});

test("nome do arquivo sem acentos", () => {
  assert.equal(nomeArquivoEquipes("23º Acampamento Sênior"), "equipes-evangelizacao-23-acampamento-senior.xlsx");
});
