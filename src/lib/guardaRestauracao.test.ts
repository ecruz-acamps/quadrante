import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { criarBancoTemporario } from "./testdb";

const banco = criarBancoTemporario();
process.env.DATABASE_URL = banco.url;
process.env.RESTAURACAO_CODIGO = "AAAA-BBBB-CCCC";

type Db = typeof import("./db").db;
let db: Db;
let guardarAcesso: typeof import("./guardaRestauracao").guardarAcesso;
let limparTentativas: typeof import("./codigoRestauracao").limparTentativas;

before(async () => {
  db = (await import("./db")).db;
  guardarAcesso = (await import("./guardaRestauracao")).guardarAcesso;
  limparTentativas = (await import("./codigoRestauracao")).limparTentativas;
});

beforeEach(() => limparTentativas());

after(async () => {
  limparTentativas();
  await db?.$disconnect();
  banco.limpar();
});

test("403 com código errado e null (liberado) com o certo", async () => {
  const errado = await guardarAcesso("XXXX-XXXX-XXXX");
  assert.equal(errado?.status, 403);
  assert.equal(typeof (await errado!.json()).erro, "string");
  assert.equal(await guardarAcesso("aaaa-bbbb-cccc"), null);
});

test("429 na 6ª tentativa, mesmo que a 6ª tenha o código certo", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await guardarAcesso("ERRADO"))?.status, 403);
  assert.equal((await guardarAcesso("AAAA-BBBB-CCCC"))?.status, 429);
});

test("404 vem antes do 429 e do 403 quando já existe usuário", async () => {
  for (let i = 0; i < 6; i++) await guardarAcesso("ERRADO"); // já bloqueado
  await db.usuario.create({ data: { nome: "A", email: "a@x.com", role: "SUPER" } });
  assert.equal((await guardarAcesso("AAAA-BBBB-CCCC"))?.status, 404);
  assert.equal((await guardarAcesso("ERRADO"))?.status, 404);
});
