import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { exchangeCodeForToken, getGoogleUserInfo } from "@/lib/googleAuth";

const STATE_COOKIE = "quadrante_oauth_state";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    redirect("/login?error=oauth");
  }

  const { access_token } = await exchangeCodeForToken(code!);
  const info = await getGoogleUserInfo(access_token);

  const email = info.email.toLowerCase();
  const dominio = process.env.GSUITE_DOMAIN;
  // domínio é obrigatório: sem ele qualquer conta Google conseguiria entrar
  if (!dominio) redirect("/login?error=oauth");
  if (!info.email_verified || info.hd?.toLowerCase() !== dominio.toLowerCase() || !email.endsWith(`@${dominio.toLowerCase()}`)) {
    redirect("/login?error=dominio");
  }

  const existente = await db.usuario.findUnique({ where: { email } });
  // O Google só autentica. Usuário novo do domínio entra como ADMIN sem missões e sem acesso a dados
  // até um SUPER liberar em /usuarios; o perfil de quem já existe nunca é alterado aqui.
  const user =
    existente ??
    (await db.usuario.create({
      data: { nome: info.name || email, email, senha: null, role: "ADMIN" },
    }));

  await createSession(user.id);
  redirect("/");
}
