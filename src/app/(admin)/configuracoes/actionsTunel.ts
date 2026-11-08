"use server";

import { revalidatePath } from "next/cache";
import { sistemaVazio } from "@/lib/sistemaVazio";
import { requireRole } from "@/lib/auth";
import { ErroCloudflare } from "@/lib/cloudflare";
import { confirmaTroca, criarEAtivarTunel } from "@/lib/tunelCloudflare";
import { chamarAuxiliar, ErroAuxiliar } from "@/lib/auxiliarTunel";
import { removeEnvValue, setEnvValue } from "@/lib/envFile";

export type EstadoLigarTunel = {
  erro?: string;
  ok?: string;
  confirmar?: { tipo: string; conteudo: string; hostname: string };
};

function mensagemSegura(err: unknown, padrao: string): string {
  // só erros nossos (sem token) vão para a tela; qualquer outra coisa fica no registro do servidor
  if (err instanceof ErroCloudflare || err instanceof ErroAuxiliar) return err.message;
  console.error("Erro inesperado no túnel Cloudflare:", err instanceof Error ? err.name : "desconhecido");
  return padrao;
}

// O token da API é usado só aqui, nesta requisição: não é gravado em disco, .env nem log.
export async function ligarTunelAction(_prev: unknown, fd: FormData): Promise<EstadoLigarTunel> {
  // numa instalação nova (sem usuários) ainda não há login: a tela /restaurar também pode ligar o túnel
  if (!(await sistemaVazio())) await requireRole("SUPER");
  const tokenApi = String(fd.get("tokenApi") ?? "").trim();
  const hostname = String(fd.get("hostname") ?? "").trim().toLowerCase();
  if (!tokenApi) return { erro: "Cole o token da API da Cloudflare." };
  try {
    const r = await criarEAtivarTunel(
      {
        tokenApi,
        hostname,
        confirmarTrocaDns: confirmaTroca(
          { confirmar: fd.get("confirmar") as string | null, confirmarHostname: fd.get("confirmarHostname") as string | null },
          hostname,
        ),
      },
      { fetch, ligar: (tokenTunel) => chamarAuxiliar("ligar", `${tokenTunel}\n`).then(() => undefined) },
    );
    if (r.estado === "CONFIRMAR_TROCA") return { confirmar: { ...r.atual, hostname } };
    await setEnvValue("TUNEL_HOSTNAME", r.hostname);
    // agora o acesso é por HTTPS: volta ao padrão seguro (cookie de login "secure"); vale na hora
    await removeEnvValue("COOKIE_SECURE");
    revalidatePath("/configuracoes");
    revalidatePath("/restaurar");
    return { ok: `Túnel ligado. Em alguns minutos o sistema abre em https://${r.hostname} (use esse endereço daqui para frente).` };
  } catch (err) {
    return { erro: mensagemSegura(err, "Não foi possível criar o túnel. Veja o registro do servidor.") };
  }
}

export async function desligarTunelAction(): Promise<{ erro?: string }> {
  await requireRole("SUPER");
  try {
    await chamarAuxiliar("desligar");
  } catch (err) {
    return { erro: mensagemSegura(err, "Não foi possível desligar o túnel.") };
  }
  await removeEnvValue("TUNEL_HOSTNAME");
  await setEnvValue("COOKIE_SECURE", "false"); // volta a permitir o acesso por HTTP na rede local
  revalidatePath("/configuracoes");
  return {};
}
