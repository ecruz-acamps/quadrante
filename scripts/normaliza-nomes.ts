// One-shot: normaliza casing de Pessoa.nome (title-case pt-BR).
// Uso: npx tsx scripts/normaliza-nomes.ts          (dry-run, mostra o que mudaria)
//      npx tsx scripts/normaliza-nomes.ts --apply  (grava no banco)
import { PrismaClient } from "@prisma/client";
import { normalizarNome } from "../src/lib/nomes";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const pessoas = await db.pessoa.findMany({ select: { id: true, nome: true } });
  const mudancas = pessoas
    .map((p) => ({ id: p.id, de: p.nome, para: normalizarNome(p.nome) }))
    .filter((m) => m.de !== m.para);

  console.log(`${pessoas.length} pessoas, ${mudancas.length} a normalizar${apply ? "" : " (dry-run)"}`);
  for (const m of mudancas.slice(0, 30)) console.log(`  "${m.de}" -> "${m.para}"`);
  if (mudancas.length > 30) console.log(`  ... e mais ${mudancas.length - 30}`);

  if (apply) {
    for (const m of mudancas) {
      await db.pessoa.update({ where: { id: m.id }, data: { nome: m.para } });
    }
    console.log(`Aplicado: ${mudancas.length} nomes atualizados.`);
  }
}

main().finally(() => db.$disconnect());
