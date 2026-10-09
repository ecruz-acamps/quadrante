// Operações de backup no Google Drive, compartilhadas pelo backup, pelo teste de restauração e pelo verificador.
import fs from "node:fs/promises";
import { refreshDriveAccessToken } from "./googleAuth";
import { setEnvValue } from "./envFile";

export type ArquivoDrive = { id: string; name: string; createdTime: string };

export async function obterAccessToken() {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "GOOGLE_DRIVE_REFRESH_TOKEN não configurado. Acesse Configurações como super-admin e clique em " +
        '"Conectar Google Drive".',
    );
  }
  const { access_token } = await refreshDriveAccessToken(refreshToken);
  return access_token;
}

export async function garantirPasta(accessToken: string): Promise<string> {
  const existente = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (existente) return existente;
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Backups Quadrante", mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!res.ok) throw new Error(`Falha ao criar pasta no Drive: ${await res.text()}`);
  const pasta = (await res.json()) as { id: string };
  await setEnvValue("GOOGLE_DRIVE_FOLDER_ID", pasta.id);
  return pasta.id;
}

export async function enviarArquivo(accessToken: string, pastaId: string, caminho: string, nome: string) {
  const bytes = await fs.readFile(caminho);
  const boundary = "quadrante-backup-boundary";
  const preambulo = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [pastaId] })}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    "utf8",
  );
  const epilogo = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: Buffer.concat([preambulo, bytes, epilogo]),
  });
  if (!res.ok) throw new Error(`Falha ao enviar backup para o Drive: ${await res.text()}`);
  const arquivo = (await res.json()) as { id: string; name: string; size?: string };
  // confere se o Drive guardou o arquivo inteiro
  if (arquivo.size && Number(arquivo.size) !== bytes.length) {
    throw new Error(`O Drive guardou ${arquivo.size} bytes, mas o arquivo tem ${bytes.length}.`);
  }
  return arquivo;
}

// do mais antigo para o mais novo
export async function listarBackups(accessToken: string, pastaId: string): Promise<ArquivoDrive[]> {
  const q = encodeURIComponent(`'${pastaId}' in parents and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime&fields=files(id,name,createdTime)&pageSize=1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Falha ao listar backups no Drive: ${await res.text()}`);
  return ((await res.json()) as { files: ArquivoDrive[] }).files;
}

export async function baixarArquivo(accessToken: string, id: string, destino: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Falha ao baixar backup do Drive: ${await res.text()}`);
  await fs.writeFile(destino, Buffer.from(await res.arrayBuffer()));
}

export async function apagarArquivo(accessToken: string, id: string) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// quais arquivos (do mais antigo) passam do limite de retenção
export function excedentes<T>(ordenadosDoMaisAntigo: T[], retencao: number): T[] {
  return ordenadosDoMaisAntigo.slice(0, Math.max(0, ordenadosDoMaisAntigo.length - retencao));
}
