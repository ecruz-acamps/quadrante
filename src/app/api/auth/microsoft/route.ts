import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { buildLoginUrl, entraConfigurado } from "@/lib/microsoftAuth";

const COOKIE_ESTADO = "quadrante_entra_state";

export async function GET() {
  if (!entraConfigurado()) redirect("/login?error=entra-config");
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(COOKIE_ESTADO, `${state}.${nonce}`, { httpOnly: true, sameSite: "lax", maxAge: 60 * 10 });
  redirect(buildLoginUrl(state, nonce));
}
