import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { db } from "./db";
import { podeUsarEvangelizacao, rotaPermitidaServoSecretaria } from "./coordenador";

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
  // sessão única: cada login incrementa a versão, invalidando os tokens de qualquer outro dispositivo/navegador
  const user = await db.usuario.update({
    where: { id: userId },
    data: { sessaoVersao: { increment: 1 } },
    select: { sessaoVersao: true },
  });
  const expiraEm = Math.floor(Date.now() / 1000) + SESSAO_MAX_SEGUNDOS;
  const payload = `${userId}.${user.sessaoVersao}.${expiraEm}`;
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

export const getSessionUserId = cache(async (): Promise<number | null> => {
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
});

// cookie com assinatura válida e não expirado, mas sem sessão ativa = foi invalidado por um login em outro dispositivo
async function sessaoSubstituida(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  const parts = token?.split(".") ?? [];
  if (parts.length !== 4) return false;
  const [uid, versao, expiraEm, assinatura] = parts;
  if (!/^[0-9a-f]+$/.test(assinatura) || !assinaturaValida(`${uid}.${versao}.${expiraEm}`, assinatura)) return false;
  return Number(expiraEm) >= Math.floor(Date.now() / 1000);
}

// exige login; aceita qualquer perfil (usada pelo layout e por requireCoordenador)
export const requireQualquerUsuario = cache(async () => {
  const id = await getSessionUserId();
  if (!id) redirect((await sessaoSubstituida()) ? "/login?error=outra-sessao" : "/login");
  const user = await db.usuario.findUnique({ where: { id } });
  if (!user) redirect("/login");
  return user;
});

// páginas e ações do sistema: o coordenador só tem acesso a /meu-setor
export const requireUser = cache(async () => {
  const user = await requireQualquerUsuario();
  if (user.role === "COORDENADOR") redirect("/meu-setor");
  if (user.role === "SERVO_SECRETARIA") {
    // o proxy grava o caminho da requisição; sem ele (ou fora das 4 áreas) a página não abre
    const caminho = (await headers()).get("x-qd-caminho");
    if (!rotaPermitidaServoSecretaria(caminho)) redirect("/servos");
  }
  return user;
});

// exige um nível mínimo de acesso; ADMIN sem permissão volta para o início
export async function requireRole(role: "SUPER") {
  const user = await requireUser();
  if (role === "SUPER" && user.role !== "SUPER") redirect("/");
  return user;
}

// ADMIN só acessa missões vinculadas a ele; SUPER acessa todas (a regra mora em autorizacao.ts)
export { podeAcessarMissao } from "./autorizacao";

// missão ativa selecionada (cookie) — ADMIN só enxerga as missões vinculadas a ele
const MISSAO_COOKIE = "quadrante_missao";

export async function setMissaoAtiva(id: number) {
  const store = await cookies();
  store.set(MISSAO_COOKIE, String(id), {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
  });
}

// missões que o usuário pode ver/editar. SUPER não é consultado aqui (sempre vê tudo).
export const getMissoesPermitidas = cache(async (userId: number) => {
  const vinculos = await db.usuarioMissao.findMany({
    where: { usuarioId: userId },
    include: { missao: true },
    orderBy: { missao: { id: "desc" } },
  });
  return vinculos.map((v) => v.missao);
});

export const getMissaoAtiva = cache(async () => {
  const userId = await getSessionUserId();
  const user = userId ? await db.usuario.findUnique({ where: { id: userId } }) : null;
  if (!user) return null;
  if (user.role === "COORDENADOR") return null; // coordenador não usa o sistema geral, só /meu-setor

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
});

// ---------- coordenador ----------
// missão do coordenador = a mais recente entre as vinculadas (sem seletor)
export async function getContextoCoordenador(user: { id: number; setor: string | null }) {
  const missoes = await getMissoesPermitidas(user.id); // já ordenadas por id desc
  return { setor: user.setor, missao: missoes[0] ?? null, missaoIds: missoes.map((m) => m.id) };
}

// única porta de entrada do perfil COORDENADOR. Outro perfil volta para o início.
// Não redireciona quando faltam setor ou missão: a página mostra o aviso de cadastro incompleto.
export const requireCoordenador = cache(async () => {
  const usuario = await requireQualquerUsuario();
  if (usuario.role !== "COORDENADOR") redirect("/");
  return { usuario, ...(await getContextoCoordenador(usuario)) };
});

// Evangelização (equipes e casas): SUPER e ADMIN com a missão ativa; coordenador do setor de Evangelização
// com a missão dele. Coordenador de outro setor volta para /meu-setor.
export const requireEvangelizacao = cache(async () => {
  const usuario = await requireQualquerUsuario();
  if (!podeUsarEvangelizacao(usuario)) redirect(usuario.role === "COORDENADOR" ? "/meu-setor" : "/");
  if (usuario.role === "COORDENADOR") {
    return { usuario, missao: (await getContextoCoordenador(usuario)).missao };
  }
  return { usuario, missao: await getMissaoAtiva() };
});
