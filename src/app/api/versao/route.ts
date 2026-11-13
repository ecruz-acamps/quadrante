import { requireRole } from "@/lib/auth";
import { versaoAtual } from "@/lib/atualizacaoSistema";

// Versão no ar. A tela de atualização usa isto para saber quando o reinício terminou: depois da troca,
// o navegador ainda tem o código antigo e as Server Actions dele deixam de existir no build novo.
export async function GET() {
  await requireRole("SUPER");
  return Response.json({ versao: await versaoAtual() }, { headers: { "Cache-Control": "no-store" } });
}
