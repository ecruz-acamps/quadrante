"use server";

import { revalidatePath } from "next/cache";
import { requireEvangelizacao, requireRole } from "./auth";
import * as ops from "./evangelizacaoOps";

type Resultado = { ok: true } | { error: string };
type Usuario = Awaited<ReturnType<typeof requireEvangelizacao>>["usuario"];

async function executar(fn: (user: Usuario) => Promise<unknown>, exigeSuper = false): Promise<Resultado> {
  const user = exigeSuper ? await requireRole("SUPER") : (await requireEvangelizacao()).usuario;
  try {
    await fn(user);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível concluir." };
  }
  revalidatePath("/evangelizacao", "layout");
  return { ok: true };
}

export async function marcarTemCarro(servoId: number, temCarro: boolean) {
  return executar((u) => ops.marcarTemCarro(u, servoId, temCarro));
}
export async function sugerirEquipes(missaoId: number) {
  return executar((u) => ops.sugerirEquipes(u, missaoId));
}
export async function criarEquipe(missaoId: number) {
  return executar((u) => ops.criarEquipe(u, missaoId));
}
export async function apagarEquipe(equipeId: number) {
  return executar((u) => ops.apagarEquipe(u, equipeId));
}
export async function moverServoEquipe(servoId: number, equipeId: number | null) {
  return executar((u) => ops.moverServoEquipe(u, servoId, equipeId));
}
export async function rodarSorteio(missaoId: number) {
  return executar((u) => ops.rodarSorteio(u, missaoId));
}
export async function moverCasa(fichaId: number, equipeId: number | null) {
  return executar((u) => ops.moverCasa(u, fichaId, equipeId));
}
export async function limparFixacoes(missaoId: number) {
  return executar((u) => ops.limparFixacoes(u, missaoId));
}
export async function fecharDistribuicao(missaoId: number) {
  return executar((u) => ops.fecharDistribuicao(u, missaoId));
}
export async function reabrirDistribuicao(missaoId: number) {
  return executar((u) => ops.reabrirDistribuicao(u, missaoId), true);
}
export async function associarApelidoCidade(texto: string, cidadeId: number) {
  return executar(() => ops.associarApelidoCidade(texto, cidadeId));
}
export async function salvarVizinhanca(cidadeId: number, vizinhasIds: number[]) {
  return executar(() => ops.salvarVizinhanca(cidadeId, vizinhasIds));
}
export async function criarCidadeDeGrafia(texto: string) {
  return executar(() => ops.criarCidadeDeGrafia(texto));
}
export async function removerApelidoCidade(apelidoId: number) {
  return executar(() => ops.removerApelidoCidade(apelidoId));
}
