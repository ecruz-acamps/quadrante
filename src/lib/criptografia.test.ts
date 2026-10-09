import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criptografarArquivo, descriptografarArquivo } from "./criptografia";

const SENHA = "uma-senha-de-teste-bem-longa-123";
let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "qd-gpg-"));
});
after(() => rmSync(dir, { recursive: true, force: true }));

test("ida e volta devolve exatamente o conteúdo original", async () => {
  const original = join(dir, "dados.bin");
  const conteudo = Buffer.concat([Buffer.from("SEGREDO-CPF-123.456.789-00"), Buffer.from([0, 255, 1, 2, 3])]);
  writeFileSync(original, conteudo);
  const cifrado = join(dir, "dados.bin.gpg");
  await criptografarArquivo(original, cifrado, SENHA);
  const volta = join(dir, "volta.bin");
  await descriptografarArquivo(cifrado, volta, SENHA);
  assert.deepEqual(readFileSync(volta), conteudo);
});

test("o arquivo cifrado não contém o texto original", async () => {
  const original = join(dir, "texto.txt");
  writeFileSync(original, "SEGREDO-CPF-123.456.789-00");
  const cifrado = join(dir, "texto.txt.gpg");
  await criptografarArquivo(original, cifrado, SENHA);
  assert.equal(readFileSync(cifrado).includes("SEGREDO-CPF"), false);
});

test("senha errada não descriptografa", async () => {
  const original = join(dir, "a.txt");
  writeFileSync(original, "conteudo");
  const cifrado = join(dir, "a.txt.gpg");
  await criptografarArquivo(original, cifrado, SENHA);
  await assert.rejects(() => descriptografarArquivo(cifrado, join(dir, "a.out"), "senha-errada-senha-errada"), /gpg/);
});

test("senha curta ou vazia é recusada antes de cifrar", async () => {
  const original = join(dir, "b.txt");
  writeFileSync(original, "x");
  await assert.rejects(() => criptografarArquivo(original, join(dir, "b.gpg"), ""), /senha/i);
  await assert.rejects(() => criptografarArquivo(original, join(dir, "b.gpg"), "curta"), /senha/i);
});

test("a senha não aparece nos argumentos do processo (vai por stdin)", async () => {
  const fonte = readFileSync(join(process.cwd(), "src/lib/criptografia.ts"), "utf8");
  assert.ok(fonte.includes('"--passphrase-fd"'));
  assert.equal(/"--passphrase"(?!-)/.test(fonte), false);
});
