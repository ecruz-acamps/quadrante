import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const db = new PrismaClient();

async function main() {
  // senha vem de SEED_ADMIN_PASSWORD ou é gerada aleatoriamente — nunca fixa no código
  const senhaPura = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
  const senha = await bcrypt.hash(senhaPura, 10);
  const criado = await db.usuario.upsert({
    where: { email: "admin@quadrante.local" },
    update: {},
    create: { nome: "Administrador", email: "admin@quadrante.local", senha, role: "SUPER" },
  });
  console.log(
    criado.senha === senha
      ? `Usuário admin@quadrante.local criado. Senha: ${senhaPura}`
      : "Usuário admin@quadrante.local já existe; senha mantida.",
  );
}

main().finally(() => db.$disconnect());
