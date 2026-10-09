/*
 * Backup diário do Quadrante para o Google Drive.
 *   1. snapshot consistente do banco (VACUUM INTO) e checagem de integridade
 *   2. compacta snapshot + .env e CRIPTOGRAFA (gpg AES256, senha BACKUP_PASSPHRASE do .env)
 *   3. envia ao Drive, confere o tamanho, apaga os mais antigos (RETENCAO)
 *   4. grava o marcador de sucesso lido por scripts/verificar-backup.ts
 * Qualquer falha manda alerta no celular (Pushbird) e sai com código 1. Sem BACKUP_PASSPHRASE não envia nada.
 *
 * Uso: npx tsx scripts/backup-to-drive.ts   (agendado no cron; ver README)
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { db } from "../src/lib/db";
import { criarSnapshot, verificarSnapshot } from "../src/lib/snapshotDb";
import { criptografarArquivo } from "../src/lib/criptografia";
import { obterAccessToken, garantirPasta, enviarArquivo, listarBackups, apagarArquivo, excedentes } from "../src/lib/driveBackup";
import { notificarOperacao } from "../src/lib/notificacoes";

const execFileAsync = promisify(execFile);
const RETENCAO = 45; // um backup por dia: ~1 mês e meio
const APP_DIR = path.resolve(__dirname, "..");
const MARCADOR = process.env.BACKUP_MARCADOR || "/var/log/quadrante/ultimo-backup-ok";

function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main() {
  const senha = process.env.BACKUP_PASSPHRASE;
  if (!senha) throw new Error("BACKUP_PASSPHRASE não configurada no .env: recusando enviar backup sem criptografia.");

  const trabalho = await fs.mkdtemp(path.join(os.tmpdir(), "qd-backup-"));
  try {
    await fs.mkdir(path.join(trabalho, "prisma"));
    const snapshot = path.join(trabalho, "prisma", "quadrante.db");
    await criarSnapshot(db, snapshot);
    const verificacao = await verificarSnapshot(snapshot);
    if (!verificacao.ok || verificacao.pessoas === 0) {
      throw new Error(`Snapshot do banco reprovado na verificação: ${verificacao.detalhe} (pessoas: ${verificacao.pessoas}).`);
    }
    await fs.copyFile(path.join(APP_DIR, ".env"), path.join(trabalho, ".env"));

    const base = `quadrante-backup-${timestamp()}`;
    const tar = path.join(trabalho, `${base}.tar.gz`);
    await execFileAsync("tar", ["-czf", tar, "-C", trabalho, "prisma", ".env"]);
    const cifrado = `${tar}.gpg`;
    await criptografarArquivo(tar, cifrado, senha);

    const token = await obterAccessToken();
    const pasta = await garantirPasta(token);
    const enviado = await enviarArquivo(token, pasta, cifrado, `${base}.tar.gz.gpg`);
    console.log("Enviado ao Drive:", enviado.name, enviado.id, `(${verificacao.pessoas} pessoas no snapshot)`);

    for (const antigo of excedentes(await listarBackups(token, pasta), RETENCAO)) {
      await apagarArquivo(token, antigo.id);
      console.log("Removido backup antigo:", antigo.name);
    }
    await fs.writeFile(MARCADOR, `${new Date().toISOString()} ${enviado.name}\n`);
    console.log("Backup concluído:", enviado.name);
  } finally {
    await fs.rm(trabalho, { recursive: true, force: true });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error("Erro no backup para o Drive:", err);
    await notificarOperacao("Backup do Quadrante FALHOU", String(err?.message ?? err).slice(0, 300)).catch(() => {});
    await db.$disconnect().catch(() => {});
    process.exit(1);
  });
