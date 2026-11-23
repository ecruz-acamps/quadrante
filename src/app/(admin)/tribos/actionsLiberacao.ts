"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { podeAcessarMissao } from "@/lib/autorizacao";
import { db } from "@/lib/db";

// "QUADRANTE OK - Liberar Evangelização": a secretaria confirma que as tribos estão prontas e a Evangelização
// passa a poder baixar as fichas separadas por tribo. Desfazer volta a bloquear.
export async function liberarEvangelizacaoAction(missaoId: number, liberar: boolean): Promise<{ erro?: string }> {
  const usuario = await requireUser();
  if (!(await podeAcessarMissao(usuario, missaoId))) return { erro: "Sem acesso a esta missão." };
  await db.missao.update({
    where: { id: missaoId },
    data: liberar
      ? { fichasEvangelizacaoLiberadasEm: new Date(), fichasEvangelizacaoLiberadasPor: usuario.nome }
      : { fichasEvangelizacaoLiberadasEm: null, fichasEvangelizacaoLiberadasPor: null },
  });
  revalidatePath("/tribos");
  revalidatePath("/evangelizacao");
  return {};
}
