import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { requireRole } from "@/lib/auth";
import { buildDriveAuthUrl } from "@/lib/googleAuth";

const STATE_COOKIE = "quadrante_drive_oauth_state";

export async function GET() {
  await requireRole("SUPER");
  const state = crypto.randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", maxAge: 60 * 10 });
  redirect(buildDriveAuthUrl(state));
}
