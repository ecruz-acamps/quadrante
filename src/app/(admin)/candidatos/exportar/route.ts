import ExcelJS from "exceljs";
import { requireUser, getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { ligarConjuges } from "@/lib/servirConjuge";
import { listarPerguntasAtivas } from "@/lib/servirPerguntasDb";
import type { RespostaSalva } from "@/lib/servirRespostas";

function lerRespostas(json: string): RespostaSalva[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? (v as RespostaSalva[]) : [];
  } catch {
    return [];
  }
}

// candidatos a servir da missão ativa em Excel: dados fixos + uma coluna por pergunta ativa
export async function GET() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return new Response("Nenhuma missão ativa.", { status: 400 });

  const [candidatos, perguntas] = await Promise.all([
    db.candidato.findMany({ where: { missaoId: missao.id }, orderBy: { nome: "asc" } }),
    listarPerguntasAtivas(db),
  ]);
  const ligacoes = ligarConjuges(candidatos);
  const porId = new Map(candidatos.map((c) => [c.id, c]));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Candidatos");
  const fixas = ["NOME", "CPF", "CELULAR", "STATUS", "DISPONÍVEL", "CASADO(A)", "CÔNJUGE", "CELULAR DO CÔNJUGE", "CÔNJUGE TAMBÉM CANDIDATO"];
  ws.addRow([...fixas, ...perguntas.map((p) => p.titulo)]);
  ws.getRow(1).font = { bold: true };
  for (const c of candidatos) {
    const respostas = lerRespostas(c.respostas);
    const par = porId.get(ligacoes.get(c.id) ?? -1);
    ws.addRow([
      c.nome, c.cpf, c.celular, c.status, c.disponivel ? "Sim" : "Não", c.casado ? "Sim" : "Não",
      c.conjugeNome ?? "", c.conjugeCelular ?? "", par?.nome ?? "",
      ...perguntas.map((p) => {
        const v = respostas.find((r) => r.perguntaId === p.id)?.valor;
        return Array.isArray(v) ? v.join(", ") : (v ?? "");
      }),
    ]);
  }
  ws.columns.forEach((col) => (col.width = 24));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: fixas.length + perguntas.length } };

  const arquivo = missao.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return new Response(new Uint8Array(await wb.xlsx.writeBuffer()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="candidatos-${arquivo || missao.id}.xlsx"`,
    },
  });
}
