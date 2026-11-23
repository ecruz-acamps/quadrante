"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { setEnvValue } from "@/lib/envFile";
import { CHAVES_ENTRA, testarCredenciais, validarEntra } from "@/lib/entraConfig";

export type EstadoEntra = { erro?: string; ok?: string } | null;

// Grava o aplicativo do Microsoft Entra no .env, só depois de a Microsoft aceitar diretório, aplicativo e segredo.
// O segredo nunca volta para a tela; em branco mantém o que já está gravado.
export async function salvarEntraAction(_prev: EstadoEntra, fd: FormData): Promise<EstadoEntra> {
  await requireRole("SUPER");
  const campo = (n: string) => String(fd.get(n) ?? "");
  const r = validarEntra(
    {
      tenantId: campo("tenantId"),
      clientId: campo("clientId"),
      segredo: campo("segredo"),
      urlLogin: campo("urlLogin"),
      urlOneDrive: campo("urlOneDrive"),
    },
    process.env.ENTRA_CLIENT_SECRET,
  );
  if ("erro" in r) return { erro: r.erro };

  const teste = await testarCredenciais(r.valores);
  if (!teste.ok) return { erro: teste.erro };

  for (const chave of CHAVES_ENTRA) await setEnvValue(chave, r.valores[chave]); // vale na hora, sem reiniciar
  revalidatePath("/configuracoes");
  return { ok: "Credenciais conferidas com a Microsoft e gravadas. Agora conecte o OneDrive (abaixo, em Backup) e teste o login com Microsoft pelo endereço https." };
}
