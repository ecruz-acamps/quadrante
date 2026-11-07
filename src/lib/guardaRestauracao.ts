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

// Roda ANTES de ler o corpo da requisição: com usuários cadastrados a rota "não existe" (404) e, em sistema vazio,
// o tamanho declarado precisa existir e caber no limite. Sem isto, qualquer pessoa na internet (túnel ligado)
// poderia fazer o servidor armazenar em memória um corpo gigante antes de qualquer checagem de código.
export async function prevalidarEnvio(request: Request, maxBytes: number): Promise<Response | null> {
  if (!(await sistemaVazio())) return json(404, "Não encontrado");
  const declarado = request.headers.get("content-length");
  if (declarado === null || !/^\d+$/.test(declarado)) return json(411, "Envio sem tamanho declarado.");
  if (Number(declarado) > maxBytes) return json(413, "O envio é grande demais.");
  return null;
}
