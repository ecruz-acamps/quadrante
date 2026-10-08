import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { db } from "./db";

const COOKIE = "quadrante_session";
const SESSAO_MAX_SEGUNDOS = 60 * 60 * 24 * 7; // 7 dias; expiração validada no servidor

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET não configurado (mínimo 32 caracteres)");
  }
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function assinaturaValida(payload: string, assinatura: string) {
  const esperada = Buffer.from(sign(payload), "hex");
  const recebida = Buffer.from(assinatura, "hex");
  return esperada.length === recebida.length && crypto.timingSafeEqual(esperada, recebida);
}

// cookie "secure" em produção (HTTPS); COOKIE_SECURE=false permite acesso HTTP em rede local
function cookieSecure() {
  return process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE !== "false" : process.env.NODE_ENV === "production";
}

// token: userId.versao.expiraEm.assinatura
export async function createSession(userId: number) {
  const user = await db.usuario.findUnique({ where: { id: userId }, select: { sessaoVersao: true } });
  const expiraEm = Math.floor(Date.now() / 1000) + SESSAO_MAX_SEGUNDOS;
  const payload = `${userId}.${user?.sessaoVersao ?? 0}.${expiraEm}`;
  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSAO_MAX_SEGUNDOS,
  });
}

// encerra a sessão e invalida no servidor todos os tokens emitidos para o usuário
export async function destroySession() {
  const userId = await getSessionUserId();
  if (userId) {
    await db.usuario.update({ where: { id: userId }, data: { sessaoVersao: { increment: 1 } } }).catch(() => {});
  }
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [uid, versao, expiraEm, assinatura] = parts;
  if (!/^[0-9a-f]+$/.test(assinatura)) return null;
  if (!assinaturaValida(`${uid}.${versao}.${expiraEm}`, assinatura)) return null;
  if (Number(expiraEm) < Math.floor(Date.now() / 1000)) return null;
  const id = Number(uid);
  if (!id) return null;
  const user = await db.usuario.findUnique({ where: { id }, select: { sessaoVersao: true } });
  if (!user || user.sessaoVersao !== Number(versao)) return null;
  return id;
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

// ADMIN só acessa missões vinculadas a ele; SUPER acessa todas
export async function podeAcessarMissao(user: { id: number; role: string }, missaoId: number) {
  if (user.role === "SUPER") return true;
  const vinculo = await db.usuarioMissao.findUnique({
    where: { usuarioId_missaoId: { usuarioId: user.id, missaoId } },
  });
  return Boolean(vinculo);
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
