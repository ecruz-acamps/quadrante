// "Exportar tribos" (aba Tribos): um arquivo Excel com uma folha por tribo — título na cor da tribo, missão e total,
// e a lista Nº da ficha | NOME | TELEFONE em ordem alfabética. Cada folha imprime numa página A4.
import ExcelJS from "exceljs";
import { COR_TRIBO_HEX } from "./constants";
import { corDaTribo } from "./fichaArquivos";
import { telefone } from "./format";

export type TriboParaExportar = {
  nome: string; // "TRIBO AZUL"
  campistas: { numero: number; nome: string; celular: string | null }[];
};

const COR_PADRAO = "1F3A6E";
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

// mistura a cor com branco (fundo claro do cabeçalho)
function clarear(hex: string, quanto: number) {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return c.map((v) => Math.round(v + (255 - v) * quanto).toString(16).padStart(2, "0")).join("");
}

// nome de folha do Excel: até 31 caracteres, sem : \ / ? * [ ] e sem repetir
function nomeFolha(base: string, usados: Set<string>) {
  const limpo = base.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "TRIBO";
  let nome = limpo;
  for (let i = 2; usados.has(nome.toUpperCase()); i++) nome = `${limpo.slice(0, 27)} (${i})`;
  usados.add(nome.toUpperCase());
  return nome;
}

export function planilhaTribos(missaoNome: string, tribos: TriboParaExportar[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const usados = new Set<string>();
  const comCampistas = tribos.filter((t) => t.campistas.length > 0);

  for (const t of comCampistas) {
    const hex = (COR_TRIBO_HEX[t.nome] ?? `#${COR_PADRAO}`).replace("#", "");
    const ws = wb.addWorksheet(nomeFolha(corDaTribo(t.nome), usados), {
      properties: { tabColor: { argb: argb(hex) } },
      views: [{ state: "frozen", ySplit: 3 }],
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
    });
    ws.columns = [{ width: 7 }, { width: 46 }, { width: 20 }];

    ws.mergeCells(1, 1, 1, 3);
    const titulo = ws.getCell(1, 1);
    titulo.value = t.nome.toUpperCase();
    titulo.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } };
    titulo.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, 3);
    const sub = ws.getCell(2, 1);
    sub.value = `${missaoNome} · ${t.campistas.length} ${t.campistas.length === 1 ? "campista" : "campistas"}`;
    sub.font = { size: 11, color: { argb: "FF555555" } };
    sub.alignment = { indent: 1 };

    const cab = ws.getRow(3);
    cab.values = ["Nº", "NOME", "TELEFONE"];
    cab.eachCell((c, col) => {
      c.font = { bold: true, color: { argb: argb(hex) } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(clarear(hex, 0.82)) } };
      c.border = { bottom: { style: "medium", color: { argb: argb(hex) } } };
      c.alignment = { horizontal: col === 1 ? "center" : "left", indent: col === 1 ? 0 : 1 };
    });

    const ordenados = [...t.campistas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    ordenados.forEach((p, i) => {
      const linha = ws.addRow([p.numero, p.nome, telefone(p.celular)]);
      linha.getCell(1).alignment = { horizontal: "center" };
      linha.getCell(2).alignment = { indent: 1 };
      linha.getCell(3).alignment = { indent: 1 };
      if (i % 2 === 1) {
        linha.eachCell({ includeEmpty: true }, (c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(clarear(hex, 0.94)) } };
        });
      }
    });
    ws.pageSetup.printTitlesRow = "1:3";
  }

  if (comCampistas.length === 0) {
    const ws = wb.addWorksheet("Tribos");
    ws.getCell(1, 1).value = `${missaoNome}: nenhuma tribo tem campistas ainda.`;
  }
  return wb;
}

export function nomeArquivoTribos(missaoNome: string) {
  const slug = missaoNome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `tribos-${slug || "missao"}.xlsx`;
}
