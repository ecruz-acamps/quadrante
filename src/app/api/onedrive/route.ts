import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { requireRole } from "@/lib/auth";
import { buildOneDriveUrl, entraConfigurado } from "@/lib/microsoftAuth";

const COOKIE_ESTADO = "quadrante_onedrive_state";

// "Conectar OneDrive" em Configurações: a conta que autorizar guarda as fichas e os backups.
export async function GET() {
  await requireRole("SUPER");
  if (!entraConfigurado()) redirect("/configuracoes?onedrive=sem-config#onedrive");
  const state = crypto.randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(COOKIE_ESTADO, state, { httpOnly: true, sameSite: "lax", maxAge: 60 * 10 });
  redirect(buildOneDriveUrl(state));
}
