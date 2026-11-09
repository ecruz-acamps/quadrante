import ExcelJS from "exceljs";
import { requireUser, getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES, ordenarSetores } from "@/lib/constants";

// Quem faltou em alguma formação (marcado "Não"), com indicação de 1º servir.
// "1º servir" usa a mesma regra da tela: pessoa com um único registro de servo.
const COLUNAS = [
  { header: "NOME", width: 38 },
  { header: "CELULAR", width: 18 },
  { header: "SETOR", width: 24 },
  { header: "FUNÇÃO", width: 14 },
  { header: "1º SERVIR?", width: 12 },
  { header: "1ª FORMAÇÃO", width: 14 },
  { header: "2ª FORMAÇÃO", width: 14 },
  { header: "3ª FORMAÇÃO", width: 14 },
  { header: "MOTIVO 1ª", width: 30 },
  { header: "MOTIVO 2ª", width: 30 },
  { header: "MOTIVO 3ª", width: 30 },
];

export async function GET(req: Request) {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return new Response("Nenhuma missão ativa.", { status: 400 });
  const setorFiltro = new URL(req.url).searchParams.get("setor") || undefined;

  const [servos, setores] = await Promise.all([
    db.servo.findMany({
      where: {
        missaoId: missao.id,
        status: "ATIVO",
        ...(setorFiltro ? { setor: setorFiltro } : {}),
        OR: [{ formacao1: "Não" }, { formacao2: "Não" }, { formacao3: "Não" }],
      },
      include: { pessoa: true },
    }),
    db.setor.findMany({ orderBy: { nome: "asc" } }).then(ordenarSetores),
  ]);

  const contagens = await db.servo.groupBy({
    by: ["pessoaId"],
    where: { pessoaId: { in: servos.map((s) => s.pessoaId) } },
    _count: true,
  });
  const primeiroServir = new Set(contagens.filter((c) => c._count <= 1).map((c) => c.pessoaId));

  const idxSetor = (n: string) => {
    const i = setores.findIndex((x) => x.nome === n);
    return i === -1 ? setores.length : i;
  };
  const idxFuncao = (f: string) => {
    const i = FUNCOES.indexOf(f);
    return i === -1 ? FUNCOES.length : i;
  };
  servos.sort(
    (a, b) =>
      idxSetor(a.setor) - idxSetor(b.setor) ||
      idxFuncao(a.funcao) - idxFuncao(b.funcao) ||
      a.pessoa.nome.localeCompare(b.pessoa.nome),
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Faltas na formação", { views: [{ state: "frozen", ySplit: 2 }] });
  ws.columns = COLUNAS.map((c) => ({ width: c.width }));

  const novatos = servos.filter((s) => primeiroServir.has(s.pessoaId)).length;
  ws.mergeCells(1, 1, 1, COLUNAS.length);
  const t = ws.getCell(1, 1);
  t.value = `Faltas na formação${setorFiltro ? ` — ${setorFiltro}` : ""} — ${servos.length} servos (${novatos} no 1º servir)`;
  t.font = { bold: true, size: 12 };

  const cab = ws.addRow(COLUNAS.map((c) => c.header));
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A6E" } };
  });

  const status = (v: string | null) => (v === "Não" ? "Faltou" : v ? "Presente" : "");
  const motivo = (n: 1 | 2 | 3, s: (typeof servos)[number]) =>
    (n === 1 ? s.motivoFalta1 : n === 2 ? s.motivoFalta2 : s.motivoFalta3) ?? (n === 1 ? s.motivoFalta : null) ?? "";

  for (const s of servos) {
    ws.addRow([
      s.pessoa.nome,
      s.pessoa.celular ?? "",
      s.setor,
      s.funcao,
      primeiroServir.has(s.pessoaId) ? "Sim" : "Não",
      status(s.formacao1),
      status(s.formacao2),
      status(s.formacao3),
      s.formacao1 === "Não" ? motivo(1, s) : "",
      s.formacao2 === "Não" ? motivo(2, s) : "",
      s.formacao3 === "Não" ? motivo(3, s) : "",
    ]);
  }
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLUNAS.length } };

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="faltas-formacao.xlsx"`,
    },
  });
}
