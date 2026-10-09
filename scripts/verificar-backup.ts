/*
 * Alarme de silêncio: avisa no celular se o último backup bem-sucedido tem mais de LIMITE_HORAS.
 * Cobre o caso em que o próprio backup nem chega a rodar (cron parado, servidor fora do ar).
 * Uso (cron diário, algumas horas depois do backup): npx tsx scripts/verificar-backup.ts
 */
import "dotenv/config";
import fs from "node:fs/promises";
import { db } from "../src/lib/db";
import { notificarOperacao } from "../src/lib/notificacoes";

const LIMITE_HORAS = 26;
const MARCADOR = process.env.BACKUP_MARCADOR || "/var/log/quadrante/ultimo-backup-ok";

async function main() {
  let idadeHoras: number | null = null;
  try {
    idadeHoras = (Date.now() - (await fs.stat(MARCADOR)).mtimeMs) / 3_600_000;
  } catch {
    /* marcador inexistente */
  }
  if (idadeHoras === null || idadeHoras > LIMITE_HORAS) {
    const msg = idadeHoras === null ? "Nenhum backup bem-sucedido registrado." : `Último backup bom há ${Math.round(idadeHoras)} h.`;
    console.error("ALERTA:", msg);
    await notificarOperacao("Backup do Quadrante ATRASADO", msg);
    process.exitCode = 1;
  } else {
    console.log(`Backup em dia (último há ${idadeHoras.toFixed(1)} h).`);
  }
}

main().finally(() => db.$disconnect());
