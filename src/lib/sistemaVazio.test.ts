import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarBancoTemporario } from "./testdb";

const banco = criarBancoTemporario();
process.env.DATABASE_URL = banco.url;

type Db = typeof import("./db").db;
let db: Db;
let sistemaVazio: typeof import("./sistemaVazio").sistemaVazio;

before(async () => {
  db = (await import("./db")).db;
  sistemaVazio = (await import("./sistemaVazio")).sistemaVazio;
});

after(async () => {
  await db?.$disconnect();
  banco.limpar();
});

test("true com a tabela Usuario vazia", async () => {
  assert.equal(await sistemaVazio(), true);
});

test("false depois de criar um usuário", async () => {
  await db.usuario.create({ data: { nome: "A", email: "a@x.com", role: "SUPER" } });
  assert.equal(await sistemaVazio(), false);
});
