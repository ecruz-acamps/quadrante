import fs from "fs/promises";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env");

// Atualiza (ou adiciona) uma chave no .env em disco, preservando o resto do arquivo.
// Usado para persistir segredos obtidos em runtime (ex: refresh token do Drive) sem
// precisar reiniciar o processo manualmente editando o arquivo.
export async function setEnvValue(key: string, value: string, caminho: string = ENV_PATH) {
  let content = "";
  try {
    content = await fs.readFile(caminho, "utf8");
  } catch {
    content = "";
  }
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content = content.replace(/\n?$/, "") + `\n${line}\n`;
  }
  await fs.writeFile(caminho, content, "utf8");
  process.env[key] = value;
}

// Remove a linha `KEY=...` do .env (o resto fica intacto) e tira a chave de process.env.
export async function removeEnvValue(key: string, caminho: string = ENV_PATH) {
  let content: string;
  try {
    content = await fs.readFile(caminho, "utf8");
  } catch {
    delete process.env[key];
    return;
  }
  const re = new RegExp(`^${key}=.*\\n?`, "m");
  await fs.writeFile(caminho, content.replace(re, ""), "utf8");
  delete process.env[key];
}

// Lê o valor de uma chave direto do arquivo (sem aspas); undefined se a chave ou o arquivo não existirem.
export async function lerEnvValor(caminho: string, key: string): Promise<string | undefined> {
  let content: string;
  try {
    content = await fs.readFile(caminho, "utf8");
  } catch {
    return undefined;
  }
  const m = new RegExp(`^${key}=(.*)$`, "m").exec(content);
  if (!m) return undefined;
  const bruto = m[1].trim();
  return bruto.replace(/^(["'])(.*)\1$/, "$2");
}
