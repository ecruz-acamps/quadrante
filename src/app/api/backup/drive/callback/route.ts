import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { exchangeCodeForToken, getDriveRedirectUri } from "@/lib/googleAuth";
import { setEnvValue } from "@/lib/envFile";

const STATE_COOKIE = "quadrante_drive_oauth_state";

export async function GET(req: NextRequest) {
  await requireRole("SUPER");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    redirect("/configuracoes?drive=erro");
  }

  const tokens = await exchangeCodeForToken(code!, getDriveRedirectUri());
  if (!tokens.refresh_token) {
    // Google só emite refresh_token na primeira autorização (ou com prompt=consent,
    // que já forçamos); se não veio, oriente a revogar o acesso e tentar de novo.
    redirect("/configuracoes?drive=sem-refresh-token");
  }

  await setEnvValue("GOOGLE_DRIVE_REFRESH_TOKEN", tokens.refresh_token!);
  redirect("/configuracoes?drive=conectado");
}
