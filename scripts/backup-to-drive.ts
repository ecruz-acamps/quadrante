/*
 * Compacta o banco (prisma/quadrante.db) + .env e envia para uma pasta no Google
 * Drive do acampamento, via a conta autorizada em /backup ("Conectar Google Drive").
 * Mantém as últimas RETENCAO cópias na pasta, apagando as mais antigas.
 *
 * Uso: npx tsx scripts/backup-to-drive.ts
 * Agendado via cron a cada 15 dias (dias 1 e 16) (ver crontab -l).
 */
import "dotenv/config";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { refreshDriveAccessToken } from "../src/lib/googleAuth";
import { setEnvValue } from "../src/lib/envFile";

const execFileAsync = promisify(execFile);
const RETENCAO = 30; // ~15 meses de backups (dias 1 e 16)
const APP_DIR = path.resolve(__dirname, "..");

function timestamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

async function getAccessToken() {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "GOOGLE_DRIVE_REFRESH_TOKEN não configurado. Acesse /backup como super-admin e clique em " +
        '"Conectar Google Drive" antes de rodar este script.',
    );
  }
  const { access_token } = await refreshDriveAccessToken(refreshToken);
  return access_token;
}

async function ensureFolder(accessToken: string): Promise<string> {
  const existing = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (existing) return existing;

  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Backups Quadrante", mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!res.ok) throw new Error(`Falha ao criar pasta no Drive: ${await res.text()}`);
  const folder = (await res.json()) as { id: string };
  await setEnvValue("GOOGLE_DRIVE_FOLDER_ID", folder.id);
  console.log("Pasta criada no Drive:", folder.id);
  return folder.id;
}

async function compactar(): Promise<{ filePath: string; filename: string }> {
  const filename = `quadrante-backup-${timestamp()}.tar.gz`;
  const filePath = path.join(os.tmpdir(), filename);
  await execFileAsync("tar", ["-czf", filePath, "-C", APP_DIR, "prisma/quadrante.db", ".env"]);
  return { filePath, filename };
}

async function upload(accessToken: string, folderId: string, filePath: string, filename: string) {
  const bytes = await fs.readFile(filePath);
  const boundary = "quadrante-backup-boundary";
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
    "utf8",
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([preamble, bytes, epilogue]);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Falha ao enviar backup para o Drive: ${await res.text()}`);
  const file = (await res.json()) as { id: string; name: string };
  console.log("Enviado ao Drive:", file.name, file.id);
}

async function podarAntigos(accessToken: string, folderId: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime&fields=files(id,name,createdTime)&pageSize=1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Falha ao listar backups no Drive: ${await res.text()}`);
  const { files } = (await res.json()) as { files: { id: string; name: string }[] };

  const excedentes = files.slice(0, Math.max(0, files.length - RETENCAO));
  for (const f of excedentes) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log("Removido backup antigo:", f.name);
  }
}

async function main() {
  const accessToken = await getAccessToken();
  const folderId = await ensureFolder(accessToken);
  const { filePath, filename } = await compactar();
  try {
    await upload(accessToken, folderId, filePath, filename);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
  await podarAntigos(accessToken, folderId);
  console.log("Backup concluído:", filename);
}

main().catch((err) => {
  console.error("Erro no backup para o Drive:", err);
  process.exit(1);
});
