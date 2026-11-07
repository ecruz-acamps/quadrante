import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { criarBancoTemporario } from "./testdb";

const banco = criarBancoTemporario();
process.env.DATABASE_URL = banco.url;

type Db = typeof import("./db").db;
let db: Db;
let criarAdministrador: typeof import("./adminInicial").criarAdministrador;

before(async () => {
  db = (await import("./db")).db;
  criarAdministrador = (await import("./adminInicial")).criarAdministrador;
});

after(async () => {
  await db?.$disconnect();
  banco.limpar();
});

test("recusa nome vazio, e-mail inválido e senha curta, sem criar ninguém", async () => {
  await assert.rejects(criarAdministrador({ nome: "  ", email: "a@x.com", senha: "senha-bem-longa" }), /nome/i);
  await assert.rejects(criarAdministrador({ nome: "A", email: "sem-arroba", senha: "senha-bem-longa" }), /e-mail/i);
  await assert.rejects(criarAdministrador({ nome: "A", email: "a@x.com", senha: "123456789" }), /10 caracteres/);
  assert.equal(await db.usuario.count(), 0);
});

test("cria o SUPER com e-mail em minúsculas e senha em hash que confere", async () => {
  await criarAdministrador({ nome: "Admin", email: "  Admin@Exemplo.COM ", senha: "uma-senha-forte" });
  const u = await db.usuario.findUniqueOrThrow({ where: { email: "admin@exemplo.com" } });
  assert.equal(u.role, "SUPER");
  assert.equal(u.nome, "Admin");
  assert.ok(u.senha && u.senha !== "uma-senha-forte");
  assert.equal(await bcrypt.compare("uma-senha-forte", u.senha!), true);
});

test("recusa quando já existe usuário e não cria outro", async () => {
  await assert.rejects(criarAdministrador({ nome: "B", email: "b@x.com", senha: "outra-senha-forte" }), /já possui usuários/);
  assert.equal(await db.usuario.count(), 1);
});
