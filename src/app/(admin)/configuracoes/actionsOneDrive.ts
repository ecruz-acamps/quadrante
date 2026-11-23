"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { oneDrive, reiniciarOneDrive } from "@/lib/oneDrive";

export type EstadoPasta = { erro?: string; ok?: string } | null;

// Link de uma pasta do OneDrive ou de uma biblioteca do SharePoint: as fichas e os backups passam a ir para lá.
export async function definirPastaRaizAction(_prev: EstadoPasta, formData: FormData): Promise<EstadoPasta> {
  await requireRole("SUPER");
  const link = String(formData.get("link") ?? "").trim();
  if (!/^https:\/\/\S+$/i.test(link)) return { erro: "Cole o link (https://…) da pasta." };
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) return { erro: "Conecte o OneDrive primeiro." };
  try {
    const pasta = await oneDrive(db).resolverLinkPasta(link);
    await db.integracaoOneDrive.update({
      where: { id: 1 },
      data: { raizDriveId: pasta.driveId, raizId: pasta.id, raizNome: pasta.name, raizUrl: pasta.webUrl ?? link },
    });
  } catch (e) {
    return { erro: (e as Error).message };
  }
  reiniciarOneDrive();
  revalidatePath("/configuracoes");
  return { ok: "Pasta definida. Os próximos arquivos vão para ela." };
}

export async function usarPastaPadraoAction() {
  await requireRole("SUPER");
  await db.integracaoOneDrive.updateMany({ where: { id: 1 }, data: { raizDriveId: null, raizId: null, raizNome: null, raizUrl: null } });
  reiniciarOneDrive();
  revalidatePath("/configuracoes");
}

export async function desconectarOneDriveAction() {
  await requireRole("SUPER");
  await db.integracaoOneDrive.deleteMany({ where: { id: 1 } });
  reiniciarOneDrive();
  revalidatePath("/configuracoes");
}
