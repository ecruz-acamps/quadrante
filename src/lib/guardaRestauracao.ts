import { sistemaVazio } from "./sistemaVazio";
import { codigoConfere, tentativaBloqueada } from "./codigoRestauracao";

function json(status: number, erro: string) {
  return Response.json({ erro }, { status });
}

// Porta de entrada de toda requisição de restauração. Ordem importa:
// 404 (sistema já tem usuários: a rota "não existe") → 429 (muitas tentativas) → 403 (código errado).
// Devolve null quando o acesso está liberado.
export async function guardarAcesso(codigo: string): Promise<Response | null> {
  if (!(await sistemaVazio())) return json(404, "Não encontrado");
  if (tentativaBloqueada()) return json(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  if (!codigoConfere(process.env.RESTAURACAO_CODIGO, codigo)) return json(403, "Código de restauração incorreto.");
  return null;
}
