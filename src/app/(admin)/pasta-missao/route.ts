import { redirect } from "next/navigation";
import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { oneDrive } from "@/lib/oneDrive";

// Botão "Abrir pasta da missão" (tela inicial): leva à pasta da missão ativa no OneDrive (Quadrante/<missão>),
// criando-a se ainda não existir.
export async function GET() {
  await requireUser();
  const missao = await getMissaoAtiva();
  const texto = (msg: string, status: number) =>
    new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (!missao) return texto("Nenhuma missão ativa.", 400);
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) {
    return texto("O OneDrive não está conectado. Peça a um administrador (SUPER) para conectar em Configurações.", 409);
  }
  let url: string;
  try {
    const od = oneDrive(db);
    url = await od.urlDaPasta(await od.garantirPasta([missao.nome]));
  } catch (e) {
    return texto(`Não foi possível abrir a pasta da missão no OneDrive: ${(e as Error).message.split(" (")[0]}`, 502);
  }
  redirect(url);
}
