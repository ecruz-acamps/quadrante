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

export type Role = "SUPER" | "ADMIN" | "COORDENADOR" | "SERVO_SECRETARIA";

export function normalizarRole(v: unknown): Role {
  return v === "SUPER" || v === "COORDENADOR" || v === "SERVO_SECRETARIA" ? v : "ADMIN";
}

export function camisetaValida(v: unknown, tamanhos: readonly string[]): v is string | null {
  return v === null || (typeof v === "string" && tamanhos.includes(v));
}

export const SETOR_EVANGELIZACAO = "EVANGELIZAÇÃO";

// a Evangelização (equipes e casas) é do SUPER, do ADMIN e do coordenador do setor de Evangelização
export function podeUsarEvangelizacao(user: { role: string; setor: string | null }): boolean {
  if (user.role === "COORDENADOR") return user.setor === SETOR_EVANGELIZACAO;
  return user.role === "SUPER" || user.role === "ADMIN";
}

// SERVO_SECRETARIA vê e edita só estas áreas (rota exata ou subrota)
export const ROTAS_SERVO_SECRETARIA = [
  ["/servos", "Quadrante de Servos"],
  ["/formacao", "Formação"],
  ["/tribos", "Tribos"],
  ["/fichas", "Fichas (Neocampistas)"],
] as const;

export function rotaPermitidaServoSecretaria(caminho: string | null | undefined): boolean {
  if (!caminho) return false;
  return ROTAS_SERVO_SECRETARIA.some(([r]) => caminho === r || caminho.startsWith(`${r}/`));
}
