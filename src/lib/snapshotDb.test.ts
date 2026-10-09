import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { criarBancoTemporario } from "./testdb";

const banco = criarBancoTemporario();
process.env.DATABASE_URL = banco.url;

type Db = typeof import("./db").db;
let db: Db;
let m: typeof import("./snapshotDb");

before(async () => {
  db = (await import("./db")).db;
  m = await import("./snapshotDb");
  await db.pessoa.create({ data: { nome: "Fulano" } });
  await db.pessoa.create({ data: { nome: "Ciclana" } });
});

after(async () => {
  await db?.$disconnect();
  banco.limpar();
});

test("criarSnapshot gera uma cópia consistente e verificarSnapshot a aprova", async () => {
  const destino = join(banco.dir, "snap.db");
  await m.criarSnapshot(db, destino);
  const r = await m.verificarSnapshot(destino);
  assert.equal(r.ok, true, r.detalhe);
  assert.equal(r.pessoas, 2);
});

test("criarSnapshot recusa caminho com aspas (evita injeção no VACUUM INTO)", async () => {
  await assert.rejects(() => m.criarSnapshot(db, join(banco.dir, "x'; DROP TABLE Pessoa; --.db")), /inválido/);
});

test("criarSnapshot não sobrescreve um arquivo existente", async () => {
  const destino = join(banco.dir, "ja-existe.db");
  writeFileSync(destino, "qualquer coisa");
  await assert.rejects(() => m.criarSnapshot(db, destino));
});

test("verificarSnapshot reprova arquivo corrompido sem lançar exceção", async () => {
  const lixo = join(banco.dir, "lixo.db");
  writeFileSync(lixo, "isto não é um banco sqlite, é só texto ".repeat(200));
  const r = await m.verificarSnapshot(lixo);
  assert.equal(r.ok, false);
  assert.ok(r.detalhe.length > 0);
});

test("verificarSnapshot reprova arquivo inexistente", async () => {
  const r = await m.verificarSnapshot(join(banco.dir, "nao-existe.db"));
  assert.equal(r.ok, false);
});
