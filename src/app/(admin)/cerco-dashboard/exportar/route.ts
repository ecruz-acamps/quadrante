import * as XLSX from "xlsx";
import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { HORARIOS_CERCO } from "@/lib/constants";

export async function GET() {
  const missao = await getMissaoAtiva();
  if (!missao) return new Response("Nenhuma missão ativa.", { status: 400 });

  const servos = await db.servo.findMany({
    where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } },
    include: { pessoa: true },
  });

  const setores = [...new Set(servos.map((s) => s.setor))].sort();

  const wb = XLSX.utils.book_new();
  for (const setor of setores) {
    const doSetor = servos.filter((s) => s.setor === setor);
    const linhas = HORARIOS_CERCO.map((h) => {
      const nomes = doSetor.filter((s) => s.cercoHorario === h).map((s) => s.pessoa.nome);
      return [h, nomes.length, nomes.join(", ")];
    });
    const sheet = XLSX.utils.aoa_to_sheet([["Horário", "Qtd.", "Servos"], ...linhas]);
    const nomeAba = setor.slice(0, 31).replace(/[\\/?*[\]:]/g, "");
    XLSX.utils.book_append_sheet(wb, sheet, nomeAba || "Setor");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="grade-24h-cerco-${missao.cercoSlug}.xlsx"`,
    },
  });
}
