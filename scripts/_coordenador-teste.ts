// Uso único de verificação: cria/remove um coordenador de teste e imprime o cookie de sessão.
//   npx tsx --env-file=.env scripts/_coordenador-teste.ts criar "NOME DO SETOR" 98
//   npx tsx --env-file=.env scripts/_coordenador-teste.ts remover
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const EMAIL = "coordenador.teste@quadrante.local";

function cookie(userId: number, versao: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET ausente");
  const expiraEm = Math.floor(Date.now() / 1000) + 3600;
  const payload = `${userId}.${versao}.${expiraEm}`;
  return `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function main() {
  const [cmd, setor, missaoId] = process.argv.slice(2);
  if (cmd === "criar") {
    if (!setor || !missaoId) throw new Error("uso: criar <setor> <missaoId>");
    if (!(await db.setor.findUnique({ where: { nome: setor } }))) throw new Error(`setor inexistente: ${setor}`);
    await db.usuario.deleteMany({ where: { email: EMAIL } });
    const u = await db.usuario.create({
      data: { nome: "Coordenador Teste", email: EMAIL, senha: null, role: "COORDENADOR", setor },
    });
    await db.usuarioMissao.create({ data: { usuarioId: u.id, missaoId: Number(missaoId) } });
    console.log(cookie(u.id, u.sessaoVersao));
  } else if (cmd === "remover") {
    const r = await db.usuario.deleteMany({ where: { email: EMAIL } });
    console.log(`removidos: ${r.count}`);
  } else {
    throw new Error("uso: criar <setor> <missaoId> | remover");
  }
}

main().finally(() => db.$disconnect());
