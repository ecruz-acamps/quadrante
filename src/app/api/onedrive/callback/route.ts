import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { trocarCodigoOneDrive } from "@/lib/microsoftAuth";
import { contaDoToken, reiniciarOneDrive } from "@/lib/oneDrive";

const COOKIE_ESTADO = "quadrante_onedrive_state";

export async function GET(req: NextRequest) {
  await requireRole("SUPER");
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const esperado = store.get(COOKIE_ESTADO)?.value;
  store.delete(COOKIE_ESTADO);
  if (!code || !state || !esperado || state !== esperado) redirect("/configuracoes?onedrive=erro#onedrive");

  let destino = "/configuracoes?onedrive=conectado#onedrive";
  try {
    const t = await trocarCodigoOneDrive(code!);
    if (!t.refresh_token) {
      destino = "/configuracoes?onedrive=sem-refresh-token#onedrive";
    } else {
      const conta = await contaDoToken(t.access_token);
      const anterior = await db.integracaoOneDrive.findUnique({ where: { id: 1 } });
      // trocar de conta invalida a pasta escolhida antes (ela pode não existir para a conta nova)
      const mesmaConta = anterior?.conta === conta;
      await db.integracaoOneDrive.upsert({
        where: { id: 1 },
        create: { id: 1, conta, refreshToken: t.refresh_token },
        update: {
          conta,
          refreshToken: t.refresh_token,
          ...(mesmaConta ? {} : { raizDriveId: null, raizId: null, raizNome: null, raizUrl: null }),
        },
      });
      reiniciarOneDrive();
    }
  } catch {
    destino = "/configuracoes?onedrive=erro#onedrive";
  }
  redirect(destino);
}
