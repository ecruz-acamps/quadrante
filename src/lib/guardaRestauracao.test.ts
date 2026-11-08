import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { criarBancoTemporario } from "./testdb";

const banco = criarBancoTemporario();
process.env.DATABASE_URL = banco.url;
process.env.RESTAURACAO_CODIGO = "AAAA-BBBB-CCCC";

type Db = typeof import("./db").db;
let db: Db;
let guardarAcesso: typeof import("./guardaRestauracao").guardarAcesso;
let prevalidarEnvio: typeof import("./guardaRestauracao").prevalidarEnvio;
let limparTentativas: typeof import("./codigoRestauracao").limparTentativas;

before(async () => {
  db = (await import("./db")).db;
  const g = await import("./guardaRestauracao");
  guardarAcesso = g.guardarAcesso;
  prevalidarEnvio = g.prevalidarEnvio;
  limparTentativas = (await import("./codigoRestauracao")).limparTentativas;
});

beforeEach(() => limparTentativas());

after(async () => {
  limparTentativas();
  await db?.$disconnect();
  banco.limpar();
});

test("sem código: sistema vazio libera o acesso (null)", async () => {
  assert.equal(await guardarAcesso(), null);
});

const envio = (tamanho?: number) =>
  new Request("http://x/api/restaurar", { method: "POST", headers: tamanho === undefined ? {} : { "content-length": String(tamanho) } });

test("prevalidarEnvio (sistema vazio): 411 sem content-length, 413 acima do limite e null dentro dele", async () => {
  const MAX = 200 * 1024 * 1024;
  assert.equal((await prevalidarEnvio(envio(), MAX))?.status, 411);
  assert.equal((await prevalidarEnvio(envio(MAX + 1), MAX))?.status, 413);
  assert.equal(await prevalidarEnvio(envio(MAX), MAX), null);
  assert.equal(await prevalidarEnvio(envio(1024), MAX), null);
});

test("prevalidarEnvio recusa content-length inválido", async () => {
  const r = new Request("http://x/api/restaurar", { method: "POST", headers: { "content-length": "abc" } });
  assert.equal((await prevalidarEnvio(r, 1000))?.status, 411);
});

test("404 quando já existe usuário", async () => {
  await db.usuario.create({ data: { nome: "A", email: "a@x.com", role: "SUPER" } });
  assert.equal((await guardarAcesso())?.status, 404);
});

test("prevalidarEnvio responde 404 antes de olhar o tamanho quando já existe usuário", async () => {
  assert.equal((await prevalidarEnvio(envio(5 * 1024 * 1024 * 1024), 1000))?.status, 404);
  assert.equal((await prevalidarEnvio(envio(), 1000))?.status, 404);
});
