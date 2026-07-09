// Script de uso único: vincula todo ADMIN existente à missão mais recente,
// preservando o acesso que ele já tinha antes de existir UsuarioMissao.
// Rodar uma vez após aplicar a migração usuario_missao: npx tsx scripts/backfill-usuario-missao.ts
import { db } from "../src/lib/db";

async function main() {
  const missaoRecente = await db.missao.findFirst({ orderBy: { id: "desc" } });
  if (!missaoRecente) {
    console.log("Nenhuma missão cadastrada, nada a fazer.");
    return;
  }

  const admins = await db.usuario.findMany({
    where: { role: "ADMIN" },
    include: { missoes: true },
  });

  for (const admin of admins) {
    if (admin.missoes.length > 0) continue;
    await db.usuarioMissao.create({
      data: { usuarioId: admin.id, missaoId: missaoRecente.id },
    });
    console.log(`Vinculado: ${admin.nome} -> missão ${missaoRecente.nome} (id ${missaoRecente.id})`);
  }

  console.log("Backfill concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
