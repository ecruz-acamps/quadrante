import { guardarAcesso } from "@/lib/guardaRestauracao";
import { limparTentativas } from "@/lib/codigoRestauracao";
import { criarAdministrador } from "@/lib/adminInicial";
import { removeEnvValue } from "@/lib/envFile";

// "Começar do zero": cria o primeiro administrador de um sistema vazio. Protegido pelo mesmo código de uso único.
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return Response.json({ erro: "Envio inválido." }, { status: 400 });

  const bloqueio = await guardarAcesso(String(corpo.codigo ?? ""));
  if (bloqueio) return bloqueio;

  try {
    await criarAdministrador({
      nome: String(corpo.nome ?? ""),
      email: String(corpo.email ?? ""),
      senha: String(corpo.senha ?? ""),
    });
  } catch (err) {
    return Response.json({ erro: (err as Error).message }, { status: 400 });
  }
  await removeEnvValue("RESTAURACAO_CODIGO"); // o código vale uma vez só
  limparTentativas();
  return Response.json({ ok: true });
}
