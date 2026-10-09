import ExcelJS from "exceljs";
import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HORARIOS_CERCO } from "@/lib/constants";

export async function GET() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return new Response("Nenhuma missão ativa.", { status: 400 });

  const servos = await db.servo.findMany({
    where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } },
    include: { pessoa: true },
  });

  const setores = [...new Set(servos.map((s) => s.setor))].sort();

  const wb = new ExcelJS.Workbook();
  const usadas = new Set<string>();
  for (const setor of setores) {
    const doSetor = servos.filter((s) => s.setor === setor);
    // nome de aba: até 31 caracteres, sem \ / ? * [ ] : e único
    let nomeAba = setor.slice(0, 31).replace(/[\\/?*[\]:]/g, "") || "Setor";
    for (let i = 2; usadas.has(nomeAba.toLowerCase()); i++) nomeAba = `${nomeAba.slice(0, 28)} ${i}`;
    usadas.add(nomeAba.toLowerCase());
    const sheet = wb.addWorksheet(nomeAba);
    sheet.addRow(["Horário", "Qtd.", "Servos"]);
    for (const h of HORARIOS_CERCO) {
      const nomes = doSetor.filter((s) => s.cercoHorario === h).map((s) => s.pessoa.nome);
      sheet.addRow([h, nomes.length, nomes.join(", ")]);
    }
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="grade-24h-cerco-${missao.cercoSlug}.xlsx"`,
    },
  });
}
