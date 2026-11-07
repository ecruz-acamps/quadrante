// Restauração de um backup do Drive (quadrante-backup-*.tar.gz.gpg): descriptografa, valida e troca banco + .env.
// Formato (de scripts/backup-to-drive.ts): tar.gz com `prisma/quadrante.db` e `.env`, criptografado com gpg AES256.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { descriptografarArquivo } from "./criptografia";
import { verificarSnapshot } from "./snapshotDb";
import { lerEnvValor } from "./envFile";

const execFileAsync = promisify(execFile);

export type CodigoErroRestauracao = "SENHA" | "FORMATO" | "BANCO_REPROVADO" | "MIGRACAO";

export class ErroRestauracao extends Error {
  constructor(
    public codigo: CodigoErroRestauracao,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroRestauracao";
  }
}

export type BackupPreparado = { pasta: string; arquivoBanco: string; arquivoEnv: string; pessoas: number };

const ENTRADAS_PERMITIDAS = new Set(["prisma/", "prisma/quadrante.db", ".env"]);
const ARQUIVOS_OBRIGATORIOS = ["prisma/quadrante.db", ".env"];

async function prepararSemLimpeza(arquivoCifrado: string, senha: string, pasta: string): Promise<BackupPreparado> {
  const tar = path.join(pasta, "backup.tar.gz");
  try {
    await descriptografarArquivo(arquivoCifrado, tar, senha);
  } catch (err) {
    if (/decryption failed|bad session key/i.test((err as Error).message)) {
      throw new ErroRestauracao("SENHA", "Senha incorreta (ou arquivo danificado).");
    }
    throw new ErroRestauracao("FORMATO", "O arquivo não é um backup criptografado do Quadrante.");
  }

  // confere o conteúdo ANTES de extrair: só os dois arquivos esperados, nada de caminhos fora da pasta
  let entradas: string[];
  try {
    const { stdout } = await execFileAsync("tar", ["-tzf", tar]);
    entradas = stdout.split("\n").filter(Boolean);
  } catch {
    throw new ErroRestauracao("FORMATO", "O arquivo descriptografado não é um backup válido.");
  }
  const invalido = entradas.some((e) => !ENTRADAS_PERMITIDAS.has(e));
  const faltando = ARQUIVOS_OBRIGATORIOS.some((a) => !entradas.includes(a));
  if (invalido || faltando) {
    throw new ErroRestauracao("FORMATO", "O backup não tem o conteúdo esperado (banco e .env).");
  }

  const conteudo = path.join(pasta, "conteudo");
  await fs.mkdir(conteudo);
  await execFileAsync("tar", ["-xzf", tar, "-C", conteudo]);
  const arquivoBanco = path.join(conteudo, "prisma", "quadrante.db");
  const arquivoEnv = path.join(conteudo, ".env");
  for (const f of [arquivoBanco, arquivoEnv]) {
    if (!(await fs.lstat(f)).isFile()) throw new ErroRestauracao("FORMATO", "O backup contém um item inválido.");
  }

  const v = await verificarSnapshot(arquivoBanco);
  if (!v.ok || v.pessoas === 0) {
    throw new ErroRestauracao(
      "BANCO_REPROVADO",
      v.ok ? "O banco do backup está vazio." : `O banco do backup não passou na verificação (${v.detalhe}).`,
    );
  }
  return { pasta, arquivoBanco, arquivoEnv, pessoas: v.pessoas };
}

// Quem chama apaga `pasta` depois de usar o resultado; em erro, a pasta temporária já é apagada aqui.
export async function prepararBackup(arquivoCifrado: string, senha: string): Promise<BackupPreparado> {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "qd-restaurar-"));
  try {
    return await prepararSemLimpeza(arquivoCifrado, senha, pasta);
  } catch (err) {
    await fs.rm(pasta, { recursive: true, force: true });
    throw err;
  }
}

function caminhoDoBanco(databaseUrl: string, appDir: string): string {
  const arquivo = databaseUrl.replace(/^file:/, "");
  return path.isAbsolute(arquivo) ? arquivo : path.resolve(appDir, "prisma", arquivo);
}

async function existe(f: string) {
  return fs.access(f).then(
    () => true,
    () => false,
  );
}

export type OpcoesAplicar = {
  appDir: string;
  desconectar: () => Promise<void>;
  migrar: (env: NodeJS.ProcessEnv) => Promise<void>;
};

export async function aplicarBackup(p: BackupPreparado, o: OpcoesAplicar): Promise<void> {
  const urlNova = (await lerEnvValor(p.arquivoEnv, "DATABASE_URL")) ?? "file:./quadrante.db";
  const destinoBanco = caminhoDoBanco(urlNova, o.appDir);
  const destinoEnv = path.join(o.appDir, ".env");
  const bak = ".bak-antes-restauracao";

  await o.desconectar();

  const tinhaBanco = await existe(destinoBanco);
  const tinhaEnv = await existe(destinoEnv);
  if (tinhaBanco) await fs.rename(destinoBanco, destinoBanco + bak);
  if (tinhaEnv) await fs.rename(destinoEnv, destinoEnv + bak);
  // restos de journal/WAL do banco antigo não podem ser aplicados ao banco novo
  for (const s of ["-wal", "-shm", "-journal"]) await fs.rm(destinoBanco + s, { force: true });

  try {
    await fs.mkdir(path.dirname(destinoBanco), { recursive: true });
    await fs.copyFile(p.arquivoBanco, destinoBanco + ".novo");
    await fs.rename(destinoBanco + ".novo", destinoBanco);
    await fs.copyFile(p.arquivoEnv, destinoEnv + ".novo");
    await fs.rename(destinoEnv + ".novo", destinoEnv);
    await o.migrar({ ...process.env, DATABASE_URL: urlNova });
  } catch (err) {
    // volta tudo como estava
    await fs.rm(destinoBanco, { force: true });
    await fs.rm(destinoEnv, { force: true });
    if (tinhaBanco) await fs.rename(destinoBanco + bak, destinoBanco);
    if (tinhaEnv) await fs.rename(destinoEnv + bak, destinoEnv);
    throw new ErroRestauracao("MIGRACAO", `Não foi possível atualizar o banco do backup: ${(err as Error).message}`);
  }
}

// Aplica as migrações pendentes (o backup pode vir de um esquema mais antigo). Sem shell.
export function migrarComPrisma(appDir: string): (env: NodeJS.ProcessEnv) => Promise<void> {
  return async (env) => {
    await execFileAsync(process.execPath, [path.join(appDir, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
      cwd: appDir,
      env,
    });
  };
}
