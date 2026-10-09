import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// banco temporário e vazio, criado pelas migrações: nunca toca em prisma/quadrante.db
const dir = mkdtempSync(join(tmpdir(), "qd-autz-"));
process.env.DATABASE_URL = `file:${join(dir, "teste.db")}`;

type Mod = typeof import("./autorizacao");
type Db = typeof import("./db").db;
let m: Mod;
let db: Db;

const ids = {} as Record<string, number>;
const adminA = () => ({ id: ids.adminA, role: "ADMIN" });
const adminSemMissao = () => ({ id: ids.adminSem, role: "ADMIN" });
const superUser = () => ({ id: ids.super, role: "SUPER" });

before(async () => {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  });
  m = await import("./autorizacao");
  db = (await import("./db")).db;

  const mk = (nome: string, slug: string) =>
    db.missao.create({ data: { nome, tipo: "SENIOR", ano: 1, cercoSlug: slug } });
  const A = await mk("Missao A", "a");
  const B = await mk("Missao B", "b");
  ids.A = A.id;
  ids.B = B.id;

  const u = (email: string, role: string) => db.usuario.create({ data: { nome: email, email, role } });
  ids.adminA = (await u("a@x", "ADMIN")).id;
  ids.adminSem = (await u("s@x", "ADMIN")).id;
  ids.super = (await u("su@x", "SUPER")).id;
  await db.usuarioMissao.create({ data: { usuarioId: ids.adminA, missaoId: A.id } });

  const pessoa = await db.pessoa.create({ data: { nome: "Fulano" } });
  const pessoa2 = await db.pessoa.create({ data: { nome: "Ciclana" } });
  ids.servoA = (await db.servo.create({ data: { missaoId: A.id, pessoaId: pessoa.id, setor: "TROPA" } })).id;
  ids.servoB = (await db.servo.create({ data: { missaoId: B.id, pessoaId: pessoa2.id, setor: "TROPA" } })).id;

  const ficha = (missaoId: number, numero: number) =>
    db.neocampista.create({ data: { missaoId, numero, nucleo: "N", nome: `F${missaoId}-${numero}` } });
  const fA1 = await ficha(A.id, 1);
  const fA2 = await ficha(A.id, 2);
  const fB1 = await ficha(B.id, 1);
  const fB2 = await ficha(B.id, 2);
  ids.fichaA1 = fA1.id;
  ids.fichaA2 = fA2.id;
  ids.fichaB1 = fB1.id;
  ids.fichaB2 = fB2.id;

  ids.triboA = (await db.tribo.create({ data: { missaoId: A.id, nome: "TRIBO A" } })).id;
  ids.triboB = (await db.tribo.create({ data: { missaoId: B.id, nome: "TRIBO B" } })).id;
  ids.alertaA = (await db.fichaAlerta.create({ data: { origemId: fA1.id, alvoId: fA2.id } })).id;
  ids.alertaB = (await db.fichaAlerta.create({ data: { origemId: fB1.id, alvoId: fB2.id } })).id;
  ids.liderA = (await db.triboLider.create({ data: { triboId: ids.triboA, servoId: ids.servoA } })).id;
  ids.liderB = (await db.triboLider.create({ data: { triboId: ids.triboB, servoId: ids.servoB } })).id;
});

after(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("podeAcessarMissao: ADMIN só nas missões vinculadas; SUPER em todas", async () => {
  assert.equal(await m.podeAcessarMissao(adminA(), ids.A), true);
  assert.equal(await m.podeAcessarMissao(adminA(), ids.B), false);
  assert.equal(await m.podeAcessarMissao(adminSemMissao(), ids.A), false);
  assert.equal(await m.podeAcessarMissao(superUser(), ids.B), true);
});

test("podeAcessarMissao: id inválido (NaN, 0, decimal) nunca é aceito, nem para SUPER", async () => {
  for (const id of [NaN, 0, -1, 1.5, Infinity]) {
    assert.equal(await m.podeAcessarMissao(adminA(), id), false);
    assert.equal(await m.podeAcessarMissao(superUser(), id), false);
  }
});

test("acessoRegistros: servo, ficha, tribo, alerta e líder da própria missão passam", async () => {
  for (const ref of [
    ["servo", ids.servoA],
    ["ficha", ids.fichaA1],
    ["tribo", ids.triboA],
    ["alerta", ids.alertaA],
    ["liderTribo", ids.liderA],
  ] as const) {
    assert.equal(await m.acessoRegistros(adminA(), ref), true, `${ref[0]} da missão A`);
  }
});

test("acessoRegistros: registro de OUTRA missão é recusado para ADMIN, liberado para SUPER", async () => {
  for (const ref of [
    ["servo", ids.servoB],
    ["ficha", ids.fichaB1],
    ["tribo", ids.triboB],
    ["alerta", ids.alertaB],
    ["liderTribo", ids.liderB],
  ] as const) {
    assert.equal(await m.acessoRegistros(adminA(), ref), false, `${ref[0]} da missão B (ADMIN)`);
    assert.equal(await m.acessoRegistros(superUser(), ref), true, `${ref[0]} da missão B (SUPER)`);
  }
});

test("acessoRegistros: ADMIN sem nenhuma missão não acessa nada", async () => {
  assert.equal(await m.acessoRegistros(adminSemMissao(), ["servo", ids.servoA]), false);
  assert.equal(await m.acessoRegistros(adminSemMissao(), ["ficha", ids.fichaA1]), false);
});

test("acessoRegistros: id inexistente ou inválido é recusado, inclusive para SUPER", async () => {
  for (const id of [999999, NaN, 0, -3, 2.5]) {
    assert.equal(await m.acessoRegistros(adminA(), ["servo", id]), false);
    assert.equal(await m.acessoRegistros(superUser(), ["ficha", id]), false);
  }
});

test("acessoRegistros: vários registros precisam estar TODOS na mesma missão", async () => {
  // duas fichas da mesma missão (par de alerta)
  assert.equal(await m.acessoRegistros(adminA(), ["ficha", ids.fichaA1], ["ficha", ids.fichaA2]), true);
  // ficha da A com tribo da B: mesmo SUPER é recusado (misturaria missões)
  assert.equal(await m.acessoRegistros(superUser(), ["ficha", ids.fichaA1], ["tribo", ids.triboB]), false);
  // ficha da A com uma da B: ADMIN que só vê A é recusado
  assert.equal(await m.acessoRegistros(adminA(), ["ficha", ids.fichaA1], ["ficha", ids.fichaB1]), false);
  // líder: servo e tribo da mesma missão
  assert.equal(await m.acessoRegistros(adminA(), ["servo", ids.servoA], ["tribo", ids.triboA]), true);
  assert.equal(await m.acessoRegistros(superUser(), ["servo", ids.servoA], ["tribo", ids.triboB]), false);
});

test("acessoRegistros: sem nenhuma referência é recusado", async () => {
  assert.equal(await m.acessoRegistros(adminA()), false);
});

test("exigirRegistros e exigirMissao lançam erro quando não há acesso", async () => {
  await assert.rejects(() => m.exigirRegistros(adminA(), ["servo", ids.servoB]), /Sem permissão/);
  await assert.rejects(() => m.exigirMissao(adminA(), ids.B), /Sem permissão/);
  await m.exigirRegistros(adminA(), ["servo", ids.servoA]);
  await m.exigirMissao(adminA(), ids.A);
});
