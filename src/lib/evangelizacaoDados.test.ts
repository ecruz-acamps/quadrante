import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// banco temporário e vazio, criado pelas migrações: nunca toca em prisma/quadrante.db
const dir = mkdtempSync(join(tmpdir(), "qd-evang-"));
process.env.DATABASE_URL = `file:${join(dir, "teste.db")}`;

type Mod = typeof import("./evangelizacaoDados");
type Db = typeof import("./db").db;
let m: Mod;
let db: Db;
const ids = {} as Record<string, number>;

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

async function novaMissao(slug: string) {
  const missao = await db.missao.create({ data: { nome: slug, tipo: "SENIOR", ano: 1, cercoSlug: slug } });
  const servo = async (nome: string, cidade: string, temCarro = false) => {
    const p = await db.pessoa.create({ data: { nome, cidade, celular: "4899" } });
    return db.servo.create({
      data: { missaoId: missao.id, pessoaId: p.id, setor: "EVANGELIZAÇÃO", status: "ATIVO", temCarro },
    });
  };
  const ficha = (numero: number, cidade: string | null, situacao = "OK") =>
    db.neocampista.create({
      data: { missaoId: missao.id, numero, nucleo: "N", nome: `Ficha ${numero}`, cidade, situacao },
    });
  return { missao, servo, ficha };
}

before(async () => {
  execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  m = await import("./evangelizacaoDados");
  db = (await import("./db")).db;
  const pal = await db.cidade.create({ data: { nome: "Palhoça" } });
  const sj = await db.cidade.create({ data: { nome: "São José" } });
  ids.pal = pal.id;
  ids.sj = sj.id;
  await db.cidadeApelido.createMany({
    data: [
      { apelido: "palhoca", cidadeId: pal.id },
      { apelido: "sao jose", cidadeId: sj.id },
    ],
  });
  await db.cidadeVizinha.createMany({
    data: [
      { cidadeId: pal.id, vizinhaId: sj.id },
      { cidadeId: sj.id, vizinhaId: pal.id },
    ],
  });
});

after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

async function cenario(slug: string) {
  const { missao, servo, ficha } = await novaMissao(slug);
  for (const [n, c, car] of [["P1", "Palhoça", true], ["P2", "PALHOÇA - SC", false], ["P3", "Palhoça", false],
    ["S1", "São José", true], ["S2", "Sao Jose", false], ["S3", "São José", false]] as const) {
    await servo(n, c, car);
  }
  const fichas = [
    await ficha(1, "PALHOÇA - SC"), await ficha(2, "Palhoça"), await ficha(3, "palhoca"),
    await ficha(4, "São José"), await ficha(5, "SAO JOSE - SC"), await ficha(6, "São José"),
    await ficha(7, "Xyz"), await ficha(8, "São José", "DESISTIU"),
  ];
  return { missao, fichas };
}

test("aplicarSugestaoEquipes cria 2 equipes e todos os servos ficam com equipe", async () => {
  const { missao } = await cenario("sug");
  const r = await m.aplicarSugestaoEquipes(missao.id);
  assert.equal(r.equipes, 2);
  const servos = await db.servo.findMany({ where: { missaoId: missao.id } });
  assert.ok(servos.every((s) => s.equipeEvangelizacaoId !== null));
  assert.equal(await db.equipeEvangelizacao.count({ where: { missaoId: missao.id } }), 2);
  // rodar de novo recria, não acumula
  await m.aplicarSugestaoEquipes(missao.id);
  assert.equal(await db.equipeEvangelizacao.count({ where: { missaoId: missao.id } }), 2);
});

test("aplicarSorteio nunca manda ficha à cidade de um membro, seja qual for a grafia", async () => {
  const { missao, fichas } = await cenario("sorteio");
  await m.aplicarSugestaoEquipes(missao.id);
  const r = await m.aplicarSorteio(missao.id, lcg(7));
  const { mapa } = await m.carregarMapaCidades();
  const { resolverCidade } = await import("./cidades");
  const equipes = await db.equipeEvangelizacao.findMany({
    where: { missaoId: missao.id },
    include: { servos: { include: { pessoa: true } } },
  });
  const cidadesDaEquipe = new Map(
    equipes.map((e) => [e.id, e.servos.map((s) => resolverCidade(s.pessoa.cidade, mapa))])
  );
  const gravadas = await db.neocampista.findMany({ where: { missaoId: missao.id } });
  let alocadas = 0;
  for (const f of gravadas.filter((x) => x.equipeEvangelizacaoId !== null)) {
    alocadas++;
    assert.ok(!cidadesDaEquipe.get(f.equipeEvangelizacaoId!)!.includes(resolverCidade(f.cidade, mapa)), f.nome);
  }
  assert.equal(alocadas, 6);
  // Xyz: pendência, sem equipe; DESISTIU: ignorada
  const xyz = gravadas.find((f) => f.id === fichas[6].id)!;
  assert.equal(xyz.equipeEvangelizacaoId, null);
  assert.deepEqual(r.pendencias, [{ casaId: xyz.id, motivo: "SEM_CIDADE" }]);
  assert.equal(gravadas.find((f) => f.id === fichas[7].id)!.equipeEvangelizacaoId, null);
});

test("casa fixada mantém a equipe depois de um novo sorteio", async () => {
  const { missao, fichas } = await cenario("fixada");
  await m.aplicarSugestaoEquipes(missao.id);
  const equipes = await db.equipeEvangelizacao.findMany({ where: { missaoId: missao.id }, orderBy: { id: "asc" } });
  await db.neocampista.update({
    where: { id: fichas[0].id },
    data: { equipeEvangelizacaoId: equipes[1].id, casaFixada: true },
  });
  for (let seed = 1; seed <= 5; seed++) {
    await m.aplicarSorteio(missao.id, lcg(seed));
    const f = await db.neocampista.findUnique({ where: { id: fichas[0].id } });
    assert.equal(f!.equipeEvangelizacaoId, equipes[1].id);
  }
});

test("carregarPainel lista equipes, casas com status, pendências e cidades desconhecidas", async () => {
  const { missao } = await cenario("painel");
  await m.aplicarSugestaoEquipes(missao.id);
  await m.aplicarSorteio(missao.id, lcg(3));
  const p = await m.carregarPainel(missao.id);
  assert.equal(p.equipes.length, 2);
  assert.ok(p.equipes.every((e) => e.membros.length === 3 && e.casas.length > 0));
  assert.ok(p.equipes.flatMap((e) => e.casas).every((c) => c.status === "OK"));
  assert.deepEqual(p.cidadesDesconhecidas, [{ texto: "Xyz", fichas: 1, servos: 0 }]);
  assert.equal(p.pendencias.length, 1);
  assert.equal(p.pendencias[0].motivo, "SEM_CIDADE");
  assert.equal(p.servosSemEquipe.length, 0);
  assert.equal(p.fechada, false);
});

test("distribuição fechada recusa sugestão, sorteio e a própria trava", async () => {
  const { missao } = await cenario("fechada");
  await m.aplicarSugestaoEquipes(missao.id);
  await db.missao.update({ where: { id: missao.id }, data: { evangelizacaoFechada: true } });
  await assert.rejects(m.exigirDistribuicaoAberta(missao.id), /Distribuição fechada/);
  await assert.rejects(m.aplicarSorteio(missao.id), /Distribuição fechada/);
  await assert.rejects(m.aplicarSugestaoEquipes(missao.id), /Distribuição fechada/);
  await db.missao.update({ where: { id: missao.id }, data: { evangelizacaoFechada: false } });
  await m.exigirDistribuicaoAberta(missao.id);
});

test("sem equipes ou sem servos o sorteio não quebra", async () => {
  const { missao } = await novaMissao("vazia");
  const r = await m.aplicarSorteio(missao.id, lcg(1));
  assert.equal(r.alocacao.size, 0);
  assert.deepEqual(await m.aplicarSugestaoEquipes(missao.id), { equipes: 0 });
});
