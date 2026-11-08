import { guardarAcesso, prevalidarEnvio } from "@/lib/guardaRestauracao";
import { limparTentativas } from "@/lib/codigoRestauracao";
import { criarAdministrador } from "@/lib/adminInicial";
import { removeEnvValue } from "@/lib/envFile";

// "Começar do zero": cria o primeiro administrador de um sistema vazio. Sem código: só funciona enquanto o sistema está vazio.
export async function POST(request: Request) {
  const antes = await prevalidarEnvio(request, 64 * 1024);
  if (antes) return antes;
  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return Response.json({ erro: "Envio inválido." }, { status: 400 });

  const bloqueio = await guardarAcesso();
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
  await removeEnvValue("RESTAURACAO_CODIGO"); // legado: instalações antigas ainda trazem o código no .env
  limparTentativas();
  return Response.json({ ok: true });
}
