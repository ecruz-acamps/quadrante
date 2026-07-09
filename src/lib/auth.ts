import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { db } from "./db";

const SECRET = process.env.AUTH_SECRET || "quadrante-dev-secret";
const COOKIE = "quadrante_session";

function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export async function createSession(userId: number) {
  const payload = `${userId}.${Date.now()}`;
  const token = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  if (sign(payload) !== parts[2]) return null;
  return Number(parts[0]) || null;
}

export async function requireUser() {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  const user = await db.usuario.findUnique({ where: { id } });
  if (!user) redirect("/login");
  return user;
}

// exige um nível mínimo de acesso; ADMIN sem permissão volta para o início
export async function requireRole(role: "SUPER") {
  const user = await requireUser();
  if (role === "SUPER" && user.role !== "SUPER") redirect("/");
  return user;
}

// missão ativa selecionada (cookie) — ADMIN só enxerga as missões vinculadas a ele
const MISSAO_COOKIE = "quadrante_missao";

export async function setMissaoAtiva(id: number) {
  const store = await cookies();
  store.set(MISSAO_COOKIE, String(id), { maxAge: 60 * 60 * 24 * 365 });
}

// missões que o usuário pode ver/editar. SUPER não é consultado aqui (sempre vê tudo).
export async function getMissoesPermitidas(userId: number) {
  const vinculos = await db.usuarioMissao.findMany({
    where: { usuarioId: userId },
    include: { missao: true },
    orderBy: { missao: { id: "desc" } },
  });
  return vinculos.map((v) => v.missao);
}

export async function getMissaoAtiva() {
  const userId = await getSessionUserId();
  const user = userId ? await db.usuario.findUnique({ where: { id: userId } }) : null;
  if (!user) return null;

  const store = await cookies();
  const raw = store.get(MISSAO_COOKIE)?.value;

  if (user.role !== "SUPER") {
    // ADMIN: só pode ver as missões vinculadas a ele
    const permitidas = await getMissoesPermitidas(user.id);
    if (permitidas.length === 0) return null;
    if (raw) {
      const escolhida = permitidas.find((m) => m.id === Number(raw));
      if (escolhida) return escolhida;
    }
    return permitidas[0]; // já vem ordenado por id desc = mais recente primeiro
  }

  // SUPER: continua respeitando o cookie entre todas as missões
  if (raw) {
    const m = await db.missao.findUnique({ where: { id: Number(raw) } });
    if (m) return m;
  }
  return db.missao.findFirst({ orderBy: { id: "desc" } });
}
