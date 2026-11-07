/*
 * Gera um backup SINTÉTICO (quadrante-backup-teste.tar.gz.gpg) no mesmo formato do backup do Drive, para testar a
 * restauração sem tocar em dados reais: banco migrado com 1 Pessoa e 1 Usuario SUPER (teste@quadrante.local),
 * e um .env com AUTH_SECRET="segredo-do-backup" e a BACKUP_PASSPHRASE informada.
 *
 * Uso (na pasta do app): npx tsx scripts/gerar-backup-teste.ts <pastaDeSaida> <senha>
 * Imprime o caminho do arquivo gerado.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { criarBancoTemporario } from "../src/lib/testdb";
import { criptografarArquivo } from "../src/lib/criptografia";

async function main() {
  const [saida, senha] = process.argv.slice(2);
  if (!saida || !senha) throw new Error("uso: gerar-backup-teste.ts <pastaDeSaida> <senha>");

  const banco = criarBancoTemporario();
  const stage = mkdtempSync(join(tmpdir(), "qd-gerar-"));
  try {
    const prisma = new PrismaClient({ datasourceUrl: banco.url });
    await prisma.pessoa.create({ data: { nome: "Pessoa de Teste" } });
    await prisma.usuario.create({
      data: { nome: "Teste", email: "teste@quadrante.local", senha: await bcrypt.hash("senha-de-teste-123", 10), role: "SUPER" },
    });
    await prisma.$disconnect();

    mkdirSync(join(stage, "prisma"));
    copyFileSync(banco.arquivo, join(stage, "prisma", "quadrante.db"));
    writeFileSync(
      join(stage, ".env"),
      `DATABASE_URL="file:./quadrante.db"\nAUTH_SECRET="segredo-do-backup"\nBACKUP_PASSPHRASE="${senha}"\n`,
    );
    const tar = join(stage, "backup.tar.gz");
    execFileSync("tar", ["-czf", tar, "-C", stage, "prisma", ".env"]);
    mkdirSync(saida, { recursive: true });
    const destino = join(saida, "quadrante-backup-teste.tar.gz.gpg");
    await criptografarArquivo(tar, destino, senha);
    console.log(destino);
  } finally {
    banco.limpar();
    rmSync(stage, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
