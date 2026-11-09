import { headers } from "next/headers";

// Limitador em memória (janela deslizante). Suficiente para um único processo Node;
// se o app passar a rodar em várias instâncias, trocar por um armazenamento compartilhado.
const tentativas = new Map<string, number[]>();
// última vez que um bloqueio dessa chave foi para o log (evita inundar o log durante um pico)
const bloqueiosLogados = new Map<string, number>();

export function excedeuLimite(chave: string, max: number, janelaMs: number): boolean {
  const agora = Date.now();
  const recentes = (tentativas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= max) {
    tentativas.set(chave, recentes);
    // deixa rastro no log do pm2: o limitador vive na memória e some a cada reinício
    if (agora - (bloqueiosLogados.get(chave) ?? 0) >= janelaMs) {
      bloqueiosLogados.set(chave, agora);
      console.warn(`[rate-limit] bloqueado chave=${chave} max=${max} janelaMs=${janelaMs}`);
    }
    return true;
  }
  recentes.push(agora);
  tentativas.set(chave, recentes);
  if (tentativas.size > 5000) {
    for (const [k, v] of tentativas) if (v.every((t) => agora - t >= janelaMs)) tentativas.delete(k);
    for (const [k, t] of bloqueiosLogados) if (agora - t >= janelaMs) bloqueiosLogados.delete(k);
  }
  return false;
}

export function limparLimite(chave: string) {
  tentativas.delete(chave);
}

export async function ipDoCliente(): Promise<string> {
  const h = await headers();
  // atrás do Cloudflare, CF-Connecting-IP é definido pela borda e não pode ser forjado pelo cliente;
  // X-Forwarded-For é só o último recurso (fora do túnel, em desenvolvimento)
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "desconhecido"
  );
}
