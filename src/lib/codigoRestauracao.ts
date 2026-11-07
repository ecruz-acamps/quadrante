import crypto from "node:crypto";
import { excedeuLimite, limparLimite } from "./rateLimit";

const CHAVE_LIMITE = "restaurar";

export function gerarCodigoRestauracao(): string {
  const hex = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

function normalizar(texto: string): string {
  return texto.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

// Compara em tempo constante. Sem código esperado (não configurado), nada confere.
export function codigoConfere(esperado: string | undefined, informado: string): boolean {
  const a = normalizar(esperado ?? "");
  if (a === "") return false;
  const b = normalizar(informado);
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// 5 tentativas por 15 min, chave global (não por IP: o IP vem de cabeçalhos que o cliente controla fora do túnel).
export function tentativaBloqueada(): boolean {
  return excedeuLimite(CHAVE_LIMITE, 5, 15 * 60_000);
}

export function limparTentativas(): void {
  limparLimite(CHAVE_LIMITE);
}

let restaurando = false;

// Trava em memória: só uma restauração por vez. Devolve a função que libera, ou null se já há uma em andamento.
export function iniciarRestauracao(): (() => void) | null {
  if (restaurando) return null;
  restaurando = true;
  return () => {
    restaurando = false;
  };
}
