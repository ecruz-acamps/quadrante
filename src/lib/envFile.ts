import fs from "fs/promises";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env");

// Atualiza (ou adiciona) uma chave no .env em disco, preservando o resto do arquivo.
// Usado para persistir segredos obtidos em runtime (ex: refresh token do Drive) sem
// precisar reiniciar o processo manualmente editando o arquivo.
export async function setEnvValue(key: string, value: string) {
  let content = "";
  try {
    content = await fs.readFile(ENV_PATH, "utf8");
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
  await fs.writeFile(ENV_PATH, content, "utf8");
  process.env[key] = value;
}
