import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { lerClaimsIdToken, trocarCodigoLogin, validarClaims } from "@/lib/microsoftAuth";

const COOKIE_ESTADO = "quadrante_entra_state";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const [estadoEsperado, nonce] = (store.get(COOKIE_ESTADO)?.value ?? "").split(".");
  store.delete(COOKIE_ESTADO);

  if (!code || !state || !estadoEsperado || !nonce || state !== estadoEsperado) redirect("/login?error=oauth");

  let email: string;
  let nome: string;
  try {
    const { id_token } = await trocarCodigoLogin(code!);
    if (!id_token) throw new Error("sem id_token");
    const r = validarClaims(lerClaimsIdToken(id_token), {
      tenantId: process.env.ENTRA_TENANT_ID!,
      clientId: process.env.ENTRA_CLIENT_ID!,
      nonce,
      agoraSeg: Math.floor(Date.now() / 1000),
    });
    if (!r.ok) redirect(r.motivo === "tenant" ? "/login?error=dominio" : "/login?error=oauth");
    ({ email, nome } = r);
  } catch (e) {
    // redirect() lança um erro próprio do Next; deixa passar
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect("/login?error=oauth");
  }

  const existente = await db.usuario.findUnique({ where: { email } });
  // A Microsoft só autentica. Usuário novo da organização entra como ADMIN sem missões e sem acesso a dados
  // até um SUPER liberar em /usuarios; o perfil de quem já existe nunca é alterado aqui.
  const user = existente ?? (await db.usuario.create({ data: { nome, email, senha: null, role: "ADMIN" } }));

  await createSession(user.id);
  redirect("/");
}
