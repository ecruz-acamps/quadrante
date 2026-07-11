import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const senha = await bcrypt.hash("quadrante123", 10);
  await db.usuario.upsert({
    where: { email: "admin@quadrante.local" },
    update: {},
    create: { nome: "Administrador", email: "admin@quadrante.local", senha },
  });
  console.log("Usuário admin@quadrante.local / quadrante123 criado.");
}

main().finally(() => db.$disconnect());
