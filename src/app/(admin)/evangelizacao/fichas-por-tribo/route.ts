import { requireEvangelizacao } from "@/lib/auth";
import { db } from "@/lib/db";
import { oneDrive } from "@/lib/oneDrive";
import { criarZip } from "@/lib/zipStream";
import { entradasFichasPorTribo, nomeZip } from "@/lib/fichasPorTribo";

// Zip com as fichas preenchidas (OneDrive), uma pasta por cor de tribo. Vai sendo enviado enquanto os arquivos
// são baixados, sem juntar tudo na memória.
export async function GET() {
  const { missao } = await requireEvangelizacao();
  if (!missao) return new Response("Nenhuma missão ativa.", { status: 400 });
  // só depois que a secretaria clicar em "QUADRANTE OK - Liberar Evangelização" (em Tribos)
  if (!missao.fichasEvangelizacaoLiberadasEm) {
    return new Response("Aguardando a secretaria liberar: em Tribos, botão \"QUADRANTE OK - Liberar Evangelização\".", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) {
    return new Response("O OneDrive não está conectado (Configurações).", { status: 409 });
  }
  const fichas = await db.neocampista.findMany({
    where: { missaoId: missao.id, arquivos: { some: {} } },
    select: {
      numero: true,
      nome: true,
      tribo: { select: { nome: true } },
      arquivos: { orderBy: { ordem: "asc" }, select: { nome: true, driveId: true, itemId: true } },
    },
  });
  if (fichas.length === 0) return new Response("Nenhuma ficha preenchida foi enviada ainda.", { status: 404 });

  // confere o acesso ao OneDrive uma vez antes de começar: com a conexão quebrada, cada arquivo falharia
  const od = oneDrive(db);
  try {
    await od.garantirPasta([]);
  } catch (e) {
    return new Response(`Não foi possível abrir o OneDrive: ${(e as Error).message.split(" (")[0]}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(criarZip(entradasFichasPorTribo(fichas, od)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeZip(missao.nome)}"`,
      "Cache-Control": "no-store",
    },
  });
}
