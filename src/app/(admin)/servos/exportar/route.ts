import ExcelJS from "exceljs";
import { requireUser, getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES, ordenarSetores } from "@/lib/constants";

// Quadrante de servos em Excel, uma aba por setor — para os coordenadores fazerem os chamados.
// Só colunas de contato/logística: sem CPF, endereço completo, pagamento ou observações.
const COLUNAS = [
  { header: "NOME", width: 38 },
  { header: "CELULAR", width: 18 },
  { header: "CIDADE", width: 20 },
  { header: "BAIRRO", width: 22 },
  { header: "FUNÇÃO", width: 14 },
  { header: "CAMISETA", width: 11 },
  { header: "CERCO", width: 16 },
];

function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

export async function GET() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return new Response("Nenhuma missão ativa.", { status: 400 });

  const [servos, setores] = await Promise.all([
    db.servo.findMany({
      where: { missaoId: missao.id, status: "ATIVO" },
      include: { pessoa: true },
    }),
    db.setor.findMany({ orderBy: { nome: "asc" } }).then(ordenarSetores),
  ]);

  const porSetor = new Map<string, typeof servos>();
  for (const s of setores) porSetor.set(s.nome, []);
  for (const s of servos) {
    if (!porSetor.has(s.setor)) porSetor.set(s.setor, []);
    porSetor.get(s.setor)!.push(s);
  }

  const idxFuncao = (f: string) => {
    const i = FUNCOES.indexOf(f);
    return i === -1 ? FUNCOES.length : i;
  };

  const wb = new ExcelJS.Workbook();
  const usadas = new Set<string>();
  for (const [setor, lista] of porSetor) {
    if (lista.length === 0) continue;
    lista.sort((a, b) => idxFuncao(a.funcao) - idxFuncao(b.funcao) || a.pessoa.nome.localeCompare(b.pessoa.nome));

    // nome de aba: até 31 caracteres, sem \ / ? * [ ] : e único
    let nomeAba = setor.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Setor";
    for (let i = 2; usadas.has(nomeAba.toLowerCase()); i++) nomeAba = `${nomeAba.slice(0, 28)} ${i}`;
    usadas.add(nomeAba.toLowerCase());

    const ws = wb.addWorksheet(nomeAba, { views: [{ state: "frozen", ySplit: 2 }] });
    ws.columns = COLUNAS.map((c) => ({ width: c.width }));

    const coord = lista.filter((s) => s.funcao === "COORDENADOR").length;
    const aux = lista.filter((s) => s.funcao === "AUXILIAR").length;
    const titulo = [
      setor,
      [plural(coord, "coordenador", "coordenadores"), plural(aux, "auxiliar", "auxiliares")].join(" + "),
      `total: ${plural(lista.length, "servo", "servos")}`,
    ].join(" — ");
    ws.mergeCells(1, 1, 1, COLUNAS.length);
    const t = ws.getCell(1, 1);
    t.value = titulo;
    t.font = { bold: true, size: 12 };

    const cab = ws.addRow(COLUNAS.map((c) => c.header));
    cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A6E" } };
    });

    for (const s of lista) {
      ws.addRow([
        s.pessoa.nome,
        s.pessoa.celular ?? "",
        s.pessoa.cidade ?? "",
        s.pessoa.bairro ?? "",
        s.funcao,
        s.camiseta ?? s.pessoa.camiseta ?? "",
        s.cercoHorario ?? "",
      ]);
    }
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLUNAS.length } };
  }

  if (wb.worksheets.length === 0) return new Response("Nenhum servo ativo no quadrante.", { status: 400 });

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const arquivo = missao.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quadrante-${arquivo || missao.id}.xlsx"`,
    },
  });
}
