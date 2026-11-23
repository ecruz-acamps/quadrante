import { requireUser, getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { nomeArquivoTribos, planilhaTribos } from "@/lib/exportarTribos";

// Botão "Exportar tribos": uma folha por tribo com Nº, nome e telefone dos campistas.
export async function GET() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return new Response("Nenhuma missão ativa.", { status: 400 });

  const tribos = await db.tribo.findMany({
    where: { missaoId: missao.id },
    orderBy: { nome: "asc" },
    include: { neocampistas: { select: { numero: true, nome: true, celular: true } } },
  });
  const wb = planilhaTribos(
    missao.nome,
    tribos.map((t) => ({ nome: t.nome, campistas: t.neocampistas })),
  );
  const nome = nomeArquivoTribos(missao.nome);
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
