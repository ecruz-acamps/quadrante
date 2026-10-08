import { headers } from "next/headers";

// Limitador em memória (janela deslizante). Suficiente para um único processo Node;
// se o app passar a rodar em várias instâncias, trocar por um armazenamento compartilhado.
const tentativas = new Map<string, number[]>();

export function excedeuLimite(chave: string, max: number, janelaMs: number): boolean {
  const agora = Date.now();
  const recentes = (tentativas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= max) {
    tentativas.set(chave, recentes);
    return true;
  }
  recentes.push(agora);
  tentativas.set(chave, recentes);
  if (tentativas.size > 5000) {
    for (const [k, v] of tentativas) if (v.every((t) => agora - t >= janelaMs)) tentativas.delete(k);
  }
  return false;
}

export function limparLimite(chave: string) {
  tentativas.delete(chave);
}

export async function ipDoCliente(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "desconhecido";
}
