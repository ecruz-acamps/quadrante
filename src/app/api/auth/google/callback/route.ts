import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { exchangeCodeForToken, getGoogleUserInfo, checkIsWorkspaceAdmin } from "@/lib/googleAuth";

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
  if (dominio && !email.endsWith(`@${dominio}`)) {
    redirect("/login?error=dominio");
  }

  const isWorkspaceAdmin = await checkIsWorkspaceAdmin(access_token, email);
  const role = isWorkspaceAdmin ? "SUPER" : "ADMIN";

  const existente = await db.usuario.findUnique({ where: { email } });
  const user = existente
    ? await db.usuario.update({
        where: { id: existente.id },
        // promove a SUPER se virou admin do Workspace; nunca rebaixa automaticamente
        data: role === "SUPER" && existente.role !== "SUPER" ? { role } : {},
      })
    : await db.usuario.create({
        data: { nome: info.name || email, email, senha: null, role },
      });

  await createSession(user.id);
  redirect("/");
}
