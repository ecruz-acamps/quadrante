"use server";

import { requireRole } from "@/lib/auth";
import { iniciarAtualizacao, lerStatusAtualizacao, type StatusAtualizacao } from "@/lib/atualizacaoSistema";
import { agendarReinicio } from "@/lib/reiniciar";

export async function iniciarAtualizacaoAction(): Promise<{ erro?: string }> {
  await requireRole("SUPER");
  if (!iniciarAtualizacao()) return { erro: "Já existe uma atualização em andamento." };
  return {};
}

export async function statusAtualizacaoAction(): Promise<StatusAtualizacao> {
  await requireRole("SUPER");
  return lerStatusAtualizacao();
}

// Depois de uma atualização concluída: sai do processo e o pm2 sobe de novo já com o build novo.
export async function reiniciarSistemaAction(): Promise<{ erro?: string }> {
  await requireRole("SUPER");
  const { estado } = await lerStatusAtualizacao();
  if (estado !== "concluido") return { erro: "Só é possível reiniciar depois de uma atualização concluída." };
  agendarReinicio();
  return {};
}
