/*
 * Teste de restauração: baixa o backup MAIS RECENTE do Drive, descriptografa, extrai numa pasta temporária
 * e confere o banco restaurado (integridade + contagem de pessoas), sem tocar no banco de produção.
 * Rode antes de cada evento e a cada poucos meses.
 * Uso: npx tsx scripts/testar-restauracao.ts
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { db } from "../src/lib/db";
import { verificarSnapshot } from "../src/lib/snapshotDb";
import { descriptografarArquivo } from "../src/lib/criptografia";
import { obterAccessToken, garantirPasta, listarBackups, baixarArquivo } from "../src/lib/driveBackup";

const execFileAsync = promisify(execFile);

async function main() {
  const senha = process.env.BACKUP_PASSPHRASE;
  if (!senha) throw new Error("BACKUP_PASSPHRASE não configurada.");
  const trabalho = await fs.mkdtemp(path.join(os.tmpdir(), "qd-restore-"));
  try {
    const token = await obterAccessToken();
    const arquivos = await listarBackups(token, await garantirPasta(token));
    const ultimo = arquivos.filter((a) => a.name.endsWith(".tar.gz.gpg")).at(-1);
    if (!ultimo) throw new Error("Nenhum backup criptografado (.tar.gz.gpg) encontrado no Drive.");
    console.log("Backup mais recente:", ultimo.name, ultimo.createdTime);

    const cifrado = path.join(trabalho, "backup.tar.gz.gpg");
    await baixarArquivo(token, ultimo.id, cifrado);
    const tar = path.join(trabalho, "backup.tar.gz");
    await descriptografarArquivo(cifrado, tar, senha);
    await execFileAsync("tar", ["-xzf", tar, "-C", trabalho]);

    const restaurado = await verificarSnapshot(path.join(trabalho, "prisma", "quadrante.db"));
    if (!restaurado.ok) throw new Error(`Banco restaurado reprovado: ${restaurado.detalhe}`);
    const envTexto = await fs.readFile(path.join(trabalho, ".env"), "utf8");
    const chaves = ["AUTH_SECRET", "DATABASE_URL"].filter((k) => new RegExp(`^${k}=`, "m").test(envTexto));
    const agora = await db.pessoa.count();
    console.log(`Banco restaurado: integridade ok, ${restaurado.pessoas} pessoas (produção agora: ${agora}).`);
    console.log(`.env restaurado contém: ${chaves.join(", ") || "nenhuma chave esperada"}.`);
    if (chaves.length < 2) throw new Error(".env restaurado incompleto.");
    console.log("RESTAURAÇÃO OK.");
  } finally {
    await fs.rm(trabalho, { recursive: true, force: true });
  }
}

main()
  .catch((err) => {
    console.error("RESTAURAÇÃO FALHOU:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
