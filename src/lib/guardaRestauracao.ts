import { sistemaVazio } from "./sistemaVazio";

function json(status: number, erro: string) {
  return Response.json({ erro }, { status });
}

// Porta de entrada de toda requisição de restauração: só existe enquanto o sistema está vazio (sem usuários).
// Não há código nem senha de acesso: quem alcançar a porta antes do primeiro administrador existir pode restaurar.
// Devolve null quando o acesso está liberado.
export async function guardarAcesso(): Promise<Response | null> {
  if (!(await sistemaVazio())) return json(404, "Não encontrado");
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
