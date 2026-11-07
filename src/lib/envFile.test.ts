import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setEnvValue, removeEnvValue, lerEnvValor } from "./envFile";

function arquivoTemporario(conteudo: string) {
  const dir = mkdtempSync(join(tmpdir(), "qd-env-"));
  const caminho = join(dir, ".env");
  writeFileSync(caminho, conteudo);
  return { caminho, limpar: () => rmSync(dir, { recursive: true, force: true }) };
}

test("setEnvValue atualiza uma chave e acrescenta outra sem perder as demais linhas", async () => {
  const t = arquivoTemporario('A="1"\nC=3\n');
  try {
    await setEnvValue("A", "2", t.caminho);
    await setEnvValue("B", "novo", t.caminho);
    const texto = readFileSync(t.caminho, "utf8");
    assert.match(texto, /^A="2"$/m);
    assert.match(texto, /^B="novo"$/m);
    assert.match(texto, /^C=3$/m);
    assert.equal(texto.includes('A="1"'), false);
  } finally {
    t.limpar();
    delete process.env.A;
    delete process.env.B;
  }
});

test("removeEnvValue remove só a chave pedida e limpa process.env", async () => {
  const t = arquivoTemporario('A="1"\nB="2"\n');
  process.env.A = "1";
  try {
    await removeEnvValue("A", t.caminho);
    const texto = readFileSync(t.caminho, "utf8");
    assert.equal(/^A=/m.test(texto), false);
    assert.match(texto, /^B="2"$/m);
    assert.equal(process.env.A, undefined);
  } finally {
    t.limpar();
  }
});

test("lerEnvValor lê com e sem aspas e devolve undefined se faltar", async () => {
  const t = arquivoTemporario('X="a b"\nY=c\n');
  try {
    assert.equal(await lerEnvValor(t.caminho, "X"), "a b");
    assert.equal(await lerEnvValor(t.caminho, "Y"), "c");
    assert.equal(await lerEnvValor(t.caminho, "Z"), undefined);
  } finally {
    t.limpar();
  }
});

test("lerEnvValor devolve undefined se o arquivo não existe", async () => {
  assert.equal(await lerEnvValor("/caminho/que/nao/existe/.env", "X"), undefined);
});
