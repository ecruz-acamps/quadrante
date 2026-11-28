// "Exportar equipes" (Evangelização): um arquivo Excel com a folha "Equipes" (cada equipe com seus integrantes,
// telefone, cidade e carro) e a folha "Casas" (as casas de cada equipe). Imprime em A4.
import ExcelJS from "exceljs";
import { telefone } from "./format";

export type EquipeParaExportar = {
  nome: string;
  membros: { nome: string; celular: string | null; cidade: string | null; temCarro: boolean }[];
  casas: { numero: number; nome: string; endereco: string | null; bairro: string | null; cidade: string | null; celular: string | null }[];
};

const AZUL = "FF1F3A6E";
export const qtd = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const CLARO = "FFE8ECF5";
const page = { paperSize: 9, orientation: "portrait" as const, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };

function titulo(ws: ExcelJS.Worksheet, colunas: number, texto: string, sub: string) {
  ws.mergeCells(1, 1, 1, colunas);
  const t = ws.getCell(1, 1);
  t.value = texto;
  t.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 28;
  ws.mergeCells(2, 1, 2, colunas);
  const s = ws.getCell(2, 1);
  s.value = sub;
  s.font = { size: 11, color: { argb: "FF555555" } };
  s.alignment = { indent: 1 };
}

function cabecalho(ws: ExcelJS.Worksheet, valores: string[]) {
  const cab = ws.addRow(valores);
  cab.eachCell((c) => {
    c.font = { bold: true, color: { argb: AZUL } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CLARO } };
    c.border = { bottom: { style: "medium", color: { argb: AZUL } } };
  });
}

function faixaEquipe(ws: ExcelJS.Worksheet, colunas: number, texto: string) {
  const linha = ws.addRow([texto]);
  ws.mergeCells(linha.number, 1, linha.number, colunas);
  linha.getCell(1).font = { bold: true, color: { argb: AZUL } };
  linha.getCell(1).border = { top: { style: "thin", color: { argb: AZUL } } };
}

export function planilhaEquipes(missaoNome: string, equipes: EquipeParaExportar[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const integrantes = equipes.reduce((n, e) => n + e.membros.length, 0);
  const totalCasas = equipes.reduce((n, e) => n + e.casas.length, 0);

  const ws = wb.addWorksheet("Equipes", { pageSetup: page });
  ws.columns = [{ width: 42 }, { width: 18 }, { width: 24 }, { width: 8 }];
  titulo(ws, 4, "EQUIPES DE EVANGELIZAÇÃO", `${missaoNome} · ${qtd(equipes.length, "equipe", "equipes")} · ${qtd(integrantes, "integrante", "integrantes")} · ${qtd(totalCasas, "casa", "casas")}`);
  cabecalho(ws, ["INTEGRANTE", "TELEFONE", "CIDADE", "CARRO"]);
  ws.pageSetup.printTitlesRow = "1:3";
  for (const e of equipes) {
    const carros = e.membros.filter((m) => m.temCarro).length;
    faixaEquipe(ws, 4, `${e.nome} · ${qtd(e.membros.length, "integrante", "integrantes")} · ${qtd(carros, "carro", "carros")} · ${qtd(e.casas.length, "casa", "casas")}`);
    for (const m of e.membros) {
      ws.addRow([m.nome, telefone(m.celular), m.cidade ?? "", m.temCarro ? "sim" : ""]);
    }
    if (e.membros.length === 0) ws.addRow(["(sem integrantes)"]).getCell(1).font = { italic: true, color: { argb: "FF888888" } };
  }

  const wc = wb.addWorksheet("Casas", { pageSetup: { ...page, orientation: "landscape" } });
  wc.columns = [{ width: 7 }, { width: 34 }, { width: 40 }, { width: 20 }, { width: 22 }, { width: 18 }];
  titulo(wc, 6, "CASAS POR EQUIPE", `${missaoNome} · ${qtd(totalCasas, "casa", "casas")}`);
  cabecalho(wc, ["Nº", "NOME", "ENDEREÇO", "BAIRRO", "CIDADE", "TELEFONE"]);
  wc.pageSetup.printTitlesRow = "1:3";
  for (const e of equipes) {
    faixaEquipe(wc, 6, `${e.nome} · ${qtd(e.casas.length, "casa", "casas")}`);
    for (const c of e.casas) {
      wc.addRow([c.numero, c.nome, c.endereco ?? "", c.bairro ?? "", c.cidade ?? "", telefone(c.celular)]);
    }
  }
  return wb;
}

export function nomeArquivoEquipes(missaoNome: string) {
  const slug = missaoNome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `equipes-evangelizacao-${slug || "missao"}.xlsx`;
}
