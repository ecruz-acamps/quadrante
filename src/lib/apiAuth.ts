// Para os endereços /api chamados pelas telas com fetch: requireUser redireciona (login, outra tela), e a tela
// receberia uma página no lugar da resposta ("resposta inesperada do servidor"). Aqui vira um JSON com o motivo.
import { requireUser } from "./auth";

type Usuario = Awaited<ReturnType<typeof requireUser>>;

export async function usuarioDaApi(): Promise<{ usuario: Usuario } | { resposta: Response }> {
  try {
    return { usuario: await requireUser() };
  } catch (e) {
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return {
        resposta: Response.json(
          { erro: "Sua sessão expirou ou seu perfil não tem acesso a esta ação. Entre de novo no sistema e tente outra vez." },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}
