// Regras do perfil COORDENADOR. Módulo puro (sem Prisma nem Next) para ser testado direto.

export const STATUS_SERVO = ["ATIVO", "RECUSOU", "DESISTIU"] as const;
export type StatusServo = (typeof STATUS_SERVO)[number];

export const MOTIVO_MAX = 500;

export function statusValido(v: unknown): v is StatusServo {
  return typeof v === "string" && (STATUS_SERVO as readonly string[]).includes(v);
}

// o coordenador só mexe em servo do setor dele e de uma missão vinculada a ele
export function podeMarcarServo(
  coordenador: { setor: string | null; missaoIds: number[] },
  servo: { setor: string; missaoId: number },
): boolean {
  if (!coordenador.setor) return false;
  return servo.setor === coordenador.setor && coordenador.missaoIds.includes(servo.missaoId);
}

// único conjunto de campos que a ação do coordenador pode gravar
export function dadosDoStatus(status: StatusServo, motivo?: string | null) {
  const texto = (motivo ?? "").trim().slice(0, MOTIVO_MAX) || null;
  return {
    status,
    confirmado: status === "ATIVO",
    motivoRecusou: status === "RECUSOU" ? texto : null,
    motivoDesistiu: status === "DESISTIU" ? texto : null,
  };
}

export type Role = "SUPER" | "ADMIN" | "COORDENADOR";

export function normalizarRole(v: unknown): Role {
  return v === "SUPER" || v === "COORDENADOR" ? v : "ADMIN";
}

export function camisetaValida(v: unknown, tamanhos: readonly string[]): v is string | null {
  return v === null || (typeof v === "string" && tamanhos.includes(v));
}
