import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { criarBancoTemporario } from "./testdb";
import { criptografarArquivo } from "./criptografia";
import { prepararBackup, aplicarBackup, ErroRestauracao } from "./restaurarBackup";

const SENHA = "senha-de-teste-123";
const ENV_BACKUP = 'DATABASE_URL="file:./quadrante.db"\nAUTH_SECRET="do-backup"\n';

const bancoCom = criarBancoTemporario();
const bancoSem = criarBancoTemporario();
const lixo: string[] = [];

function pastaTemp(prefixo = "qd-rb-") {
  const dir = mkdtempSync(join(tmpdir(), prefixo));
  lixo.push(dir);
  return dir;
}

before(async () => {
  const prisma = new PrismaClient({ datasourceUrl: bancoCom.url });
  await prisma.pessoa.create({ data: { nome: "Fulano" } });
  await prisma.$disconnect();
});

after(() => {
  bancoCom.limpar();
  bancoSem.limpar();
  for (const d of lixo) rmSync(d, { recursive: true, force: true });
});

type Opcoes = { banco?: typeof bancoCom; semEnv?: boolean; traversal?: boolean; senha?: string };

// monta quadrante-backup-teste.tar.gz.gpg como o scripts/backup-to-drive.ts monta
async function fazerBackup(o: Opcoes = {}): Promise<string> {
  const dir = pastaTemp();
  const stage = join(dir, "stage");
  mkdirSync(join(stage, "prisma"), { recursive: true });
  copyFileSync((o.banco ?? bancoCom).arquivo, join(stage, "prisma", "quadrante.db"));
  if (!o.semEnv) writeFileSync(join(stage, ".env"), ENV_BACKUP);
  const itens = o.semEnv ? ["prisma"] : ["prisma", ".env"];
  const args = ["-czf", join(dir, "b.tar.gz"), "-C", stage];
  if (o.traversal) {
    writeFileSync(join(stage, "fora.txt"), "invasor");
    args.push("-P", "--transform", "s,^fora.txt$,../fora.txt,", ...itens, "fora.txt");
  } else {
    args.push(...itens);
  }
  execFileSync("tar", args);
  const cifrado = join(dir, "quadrante-backup-teste.tar.gz.gpg");
  await criptografarArquivo(join(dir, "b.tar.gz"), cifrado, o.senha ?? SENHA);
  return cifrado;
}

async function codigoDoErro(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof ErroRestauracao ? e.codigo : `outro:${(e as Error).message}`;
  }
}

test("prepararBackup devolve 1 pessoa e os caminhos extraídos", async () => {
  const p = await prepararBackup(await fazerBackup(), SENHA);
  lixo.push(p.pasta);
  assert.equal(p.pessoas, 1);
  assert.ok(existsSync(p.arquivoBanco));
  assert.equal(readFileSync(p.arquivoEnv, "utf8"), ENV_BACKUP);
});

test("senha errada → SENHA", async () => {
  assert.equal(await codigoDoErro(prepararBackup(await fazerBackup(), "outra-senha-qualquer")), "SENHA");
});

test("arquivo que não é gpg → FORMATO", async () => {
  const arq = join(pastaTemp(), "x.gpg");
  writeFileSync(arq, "isto não é um backup");
  assert.equal(await codigoDoErro(prepararBackup(arq, SENHA)), "FORMATO");
});

test("tar com entrada ../fora.txt → FORMATO e nada criado fora da pasta", async () => {
  const cifrado = await fazerBackup({ traversal: true });
  const listado = execFileSync("tar", ["-tzf", join(cifrado, "..", "b.tar.gz")]).toString();
  assert.match(listado, /\.\.\/fora\.txt/, "a fixture precisa mesmo conter a entrada ../fora.txt");
  assert.equal(await codigoDoErro(prepararBackup(cifrado, SENHA)), "FORMATO");
});

test("tar sem .env → FORMATO", async () => {
  assert.equal(await codigoDoErro(prepararBackup(await fazerBackup({ semEnv: true }), SENHA)), "FORMATO");
});

test("banco sem nenhuma pessoa → BANCO_REPROVADO", async () => {
  assert.equal(await codigoDoErro(prepararBackup(await fazerBackup({ banco: bancoSem }), SENHA)), "BANCO_REPROVADO");
});

async function appFalso() {
  const appDir = pastaTemp("qd-app-");
  mkdirSync(join(appDir, "prisma"));
  writeFileSync(join(appDir, "prisma", "quadrante.db"), "BANCO-VELHO");
  writeFileSync(join(appDir, ".env"), "VELHO=1\n");
  return appDir;
}

test("aplicarBackup troca banco e .env e guarda os .bak-antes-restauracao", async () => {
  const p = await prepararBackup(await fazerBackup(), SENHA);
  lixo.push(p.pasta);
  const appDir = await appFalso();
  let desconectou = false;
  await aplicarBackup(p, {
    appDir,
    desconectar: async () => {
      desconectou = true;
    },
    migrar: async (env) => {
      assert.equal(env.DATABASE_URL, "file:./quadrante.db");
    },
  });
  assert.equal(desconectou, true);
  assert.equal(readFileSync(join(appDir, ".env"), "utf8"), ENV_BACKUP);
  assert.deepEqual(readFileSync(join(appDir, "prisma", "quadrante.db")), readFileSync(p.arquivoBanco));
  assert.equal(readFileSync(join(appDir, "prisma", "quadrante.db.bak-antes-restauracao"), "utf8"), "BANCO-VELHO");
  assert.equal(readFileSync(join(appDir, ".env.bak-antes-restauracao"), "utf8"), "VELHO=1\n");
});

test("migrar que falha devolve os originais e lança MIGRACAO", async () => {
  const p = await prepararBackup(await fazerBackup(), SENHA);
  lixo.push(p.pasta);
  const appDir = await appFalso();
  const codigo = await codigoDoErro(
    aplicarBackup(p, {
      appDir,
      desconectar: async () => {},
      migrar: async () => {
        throw new Error("esquema incompatível");
      },
    }),
  );
  assert.equal(codigo, "MIGRACAO");
  assert.equal(readFileSync(join(appDir, "prisma", "quadrante.db"), "utf8"), "BANCO-VELHO");
  assert.equal(readFileSync(join(appDir, ".env"), "utf8"), "VELHO=1\n");
});

test("aplicarBackup preserva o COOKIE_SECURE do .env atual (acesso por HTTP na rede local)", async () => {
  const p = await prepararBackup(await fazerBackup(), SENHA);
  lixo.push(p.pasta);
  const appDir = await appFalso();
  writeFileSync(join(appDir, ".env"), 'VELHO=1\nCOOKIE_SECURE="false"\n');
  try {
    await aplicarBackup(p, { appDir, desconectar: async () => {}, migrar: async () => {} });
    const novo = readFileSync(join(appDir, ".env"), "utf8");
    assert.match(novo, /^COOKIE_SECURE="false"$/m);
    assert.match(novo, /^AUTH_SECRET="do-backup"$/m); // o resto vem do backup
  } finally {
    delete process.env.COOKIE_SECURE;
  }
});
