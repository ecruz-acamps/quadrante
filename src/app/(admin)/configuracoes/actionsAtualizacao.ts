"use server";

import { requireRole } from "@/lib/auth";
import {
  aplicarAtualizacao,
  iniciarAtualizacao,
  lerStatusAtualizacao,
  verificarDisponivel,
  type Disponivel,
  type StatusAtualizacao,
} from "@/lib/atualizacaoSistema";

export async function iniciarAtualizacaoAction(): Promise<{ erro?: string }> {
  await requireRole("SUPER");
  if (!iniciarAtualizacao()) return { erro: "Já existe uma atualização em andamento." };
  return {};
}

export async function statusAtualizacaoAction(): Promise<StatusAtualizacao> {
  await requireRole("SUPER");
  return lerStatusAtualizacao();
}

export async function verificarDisponivelAction(): Promise<Disponivel> {
  await requireRole("SUPER");
  return verificarDisponivel(true);
}

// Normalmente o app aplica sozinho ao fim do build; isto cobre o caso de ele ter reiniciado no meio.
export async function aplicarAtualizacaoAction(): Promise<{ erro?: string }> {
  await requireRole("SUPER");
  try {
    if (!aplicarAtualizacao()) return { erro: "Não há versão nova pronta para aplicar." };
  } catch {
    return { erro: "Não foi possível trocar a versão. O sistema continua na versão anterior." };
  }
  return {};
}
