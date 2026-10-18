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

// ---------- operações (Task 7): o id vem do navegador, a missão vem do banco ----------
async function ops() {
  return import("./evangelizacaoOps");
}
async function cenarioOps(slug: string) {
  const { missao } = await cenario(slug);
  await m.aplicarSugestaoEquipes(missao.id);
  const equipes = await db.equipeEvangelizacao.findMany({ where: { missaoId: missao.id }, orderBy: { id: "asc" } });
  const servo = (await db.servo.findFirst({ where: { missaoId: missao.id } }))!;
  const ficha = (await db.neocampista.findFirst({ where: { missaoId: missao.id, numero: 1 } }))!;
  const u = (email: string, role: string) => db.usuario.create({ data: { nome: email, email: `${slug}-${email}`, role } });
  const superU = await u("super", "SUPER");
  const admin = await u("admin", "ADMIN");
  await db.usuarioMissao.create({ data: { usuarioId: admin.id, missaoId: missao.id } });
  const intruso = await u("intruso", "ADMIN");
  return {
    missao, equipes, servo, ficha,
    superUser: { id: superU.id, role: "SUPER" },
    admin: { id: admin.id, role: "ADMIN" },
    intruso: { id: intruso.id, role: "ADMIN" },
  };
}

test("moverCasa recusa equipe de outra missão e fixa a casa na equipe certa", async () => {
  const o = await ops();
  const a = await cenarioOps("ops-a");
  const b = await cenarioOps("ops-b");
  await assert.rejects(o.moverCasa(a.superUser, a.ficha.id, b.equipes[0].id), /outra missão|Sem permissão/);
  await o.moverCasa(a.admin, a.ficha.id, a.equipes[0].id);
  const f = await db.neocampista.findUnique({ where: { id: a.ficha.id } });
  assert.equal(f!.equipeEvangelizacaoId, a.equipes[0].id);
  assert.equal(f!.casaFixada, true);
  await o.moverCasa(a.admin, a.ficha.id, null);
  const solta = await db.neocampista.findUnique({ where: { id: a.ficha.id } });
  assert.deepEqual([solta!.equipeEvangelizacaoId, solta!.casaFixada], [null, false]);
});

test("usuário sem acesso à missão é recusado em toda operação", async () => {
  const o = await ops();
  const a = await cenarioOps("ops-acesso");
  const x = a.intruso;
  await assert.rejects(o.marcarTemCarro(x, a.servo.id, true), /Sem permissão/);
  await assert.rejects(o.sugerirEquipes(x, a.missao.id), /Sem permissão/);
  await assert.rejects(o.criarEquipe(x, a.missao.id), /Sem permissão/);
  await assert.rejects(o.apagarEquipe(x, a.equipes[0].id), /Sem permissão/);
  await assert.rejects(o.moverServoEquipe(x, a.servo.id, a.equipes[0].id), /Sem permissão/);
  await assert.rejects(o.rodarSorteio(x, a.missao.id), /Sem permissão/);
  await assert.rejects(o.moverCasa(x, a.ficha.id, a.equipes[0].id), /Sem permissão/);
  await assert.rejects(o.limparFixacoes(x, a.missao.id), /Sem permissão/);
  await assert.rejects(o.fecharDistribuicao(x, a.missao.id), /Sem permissão/);
  await assert.rejects(o.moverCasa(a.superUser, -1, a.equipes[0].id), /Sem permissão/);
});

test("fechada a distribuição, toda escrita é recusada; só SUPER reabre", async () => {
  const o = await ops();
  const a = await cenarioOps("ops-fechada");
  await o.fecharDistribuicao(a.admin, a.missao.id);
  const fechada = /Distribuição fechada/;
  await assert.rejects(o.marcarTemCarro(a.admin, a.servo.id, true), fechada);
  await assert.rejects(o.sugerirEquipes(a.admin, a.missao.id), fechada);
  await assert.rejects(o.criarEquipe(a.admin, a.missao.id), fechada);
  await assert.rejects(o.apagarEquipe(a.admin, a.equipes[0].id), fechada);
  await assert.rejects(o.moverServoEquipe(a.admin, a.servo.id, a.equipes[1].id), fechada);
  await assert.rejects(o.rodarSorteio(a.admin, a.missao.id), fechada);
  await assert.rejects(o.moverCasa(a.admin, a.ficha.id, a.equipes[0].id), fechada);
  await assert.rejects(o.limparFixacoes(a.admin, a.missao.id), fechada);
  await assert.rejects(o.reabrirDistribuicao(a.admin, a.missao.id), /SUPER/);
  await o.reabrirDistribuicao(a.superUser, a.missao.id);
  await o.criarEquipe(a.admin, a.missao.id);
  assert.equal(await db.equipeEvangelizacao.count({ where: { missaoId: a.missao.id } }), 3);
});

test("moverServoEquipe recusa equipe de outra missão; criar e apagar equipe soltam membros", async () => {
  const o = await ops();
  const a = await cenarioOps("ops-servo-a");
  const b = await cenarioOps("ops-servo-b");
  await assert.rejects(o.moverServoEquipe(a.superUser, a.servo.id, b.equipes[0].id), /outra missão/);
  await o.moverServoEquipe(a.admin, a.servo.id, null);
  assert.equal((await db.servo.findUnique({ where: { id: a.servo.id } }))!.equipeEvangelizacaoId, null);
  await o.apagarEquipe(a.admin, a.equipes[1].id);
  assert.equal(await db.servo.count({ where: { missaoId: a.missao.id, equipeEvangelizacaoId: a.equipes[1].id } }), 0);
  await o.marcarTemCarro(a.admin, a.servo.id, true);
  assert.equal((await db.servo.findUnique({ where: { id: a.servo.id } }))!.temCarro, true);
});

test("limparFixacoes tira a fixação sem mexer na equipe", async () => {
  const o = await ops();
  const a = await cenarioOps("ops-limpar");
  await o.moverCasa(a.admin, a.ficha.id, a.equipes[0].id);
  await o.limparFixacoes(a.admin, a.missao.id);
  const f = await db.neocampista.findUnique({ where: { id: a.ficha.id } });
  assert.deepEqual([f!.casaFixada, f!.equipeEvangelizacaoId], [false, a.equipes[0].id]);
});

test("associarApelidoCidade grava apelido normalizado e recusa conflito", async () => {
  const o = await ops();
  await o.associarApelidoCidade("Pal. - SC", ids.pal);
  assert.equal((await db.cidadeApelido.findUnique({ where: { apelido: "pal" } }))!.cidadeId, ids.pal);
  await o.associarApelidoCidade("PAL", ids.pal); // mesmo destino: ok
  await assert.rejects(o.associarApelidoCidade("pal", ids.sj), /já aponta/);
  await assert.rejects(o.associarApelidoCidade("   ", ids.pal), /vazio|inválid/i);
  await assert.rejects(o.associarApelidoCidade("abc", 99999), /não existe|inválid/i);
});

test("salvarVizinhanca grava nos dois sentidos e substitui a lista anterior", async () => {
  const o = await ops();
  const c = await db.cidade.create({ data: { nome: "Biguaçu-teste" } });
  await o.salvarVizinhanca(c.id, [ids.pal, ids.sj, c.id]);
  assert.equal(await db.cidadeVizinha.count({ where: { cidadeId: c.id } }), 2);
  assert.equal(await db.cidadeVizinha.count({ where: { vizinhaId: c.id } }), 2);
  await o.salvarVizinhanca(c.id, [ids.pal]);
  assert.equal(await db.cidadeVizinha.count({ where: { cidadeId: c.id } }), 1);
  assert.equal(await db.cidadeVizinha.count({ where: { vizinhaId: c.id } }), 1);
  // a vizinhança pré-existente entre Palhoça e São José não foi tocada
  assert.equal(await db.cidadeVizinha.count({ where: { cidadeId: ids.pal, vizinhaId: ids.sj } }), 1);
});

test("criarCidadeDeGrafia cria a cidade e o apelido; recusa nome repetido", async () => {
  const o = await ops();
  const id = await o.criarCidadeDeGrafia("Passo Fundo - RS");
  const c = await db.cidade.findUnique({ where: { id } });
  assert.equal(c!.nome, "Passo Fundo - RS");
  assert.equal((await db.cidadeApelido.findUnique({ where: { apelido: "passo fundo rs" } }))!.cidadeId, id);
  await assert.rejects(o.criarCidadeDeGrafia("Passo Fundo - RS"), /já existe/);
  await assert.rejects(o.criarCidadeDeGrafia("   "), /vazio/);
});

test("removerApelidoCidade desfaz uma associação errada e preserva o resto", async () => {
  const o = await ops();
  await o.associarApelidoCidade("S. José", ids.pal); // engano
  const ap = await db.cidadeApelido.findUnique({ where: { apelido: "s jose" } });
  assert.ok(ap);
  await o.removerApelidoCidade(ap!.id);
  assert.equal(await db.cidadeApelido.findUnique({ where: { apelido: "s jose" } }), null);
  assert.equal((await db.cidadeApelido.findUnique({ where: { apelido: "palhoca" } }))!.cidadeId, ids.pal);
  await assert.rejects(o.removerApelidoCidade(999999), /não existe|inválid/i);
});

test("carregarPainel informa carros, cota e limite de cada equipe, somando o total de casas", async () => {
  const { missao } = await cenario("cotas");
  await m.aplicarSugestaoEquipes(missao.id);
  await m.aplicarSorteio(missao.id, lcg(9));
  const p = await m.carregarPainel(missao.id);
  const totalCasas = p.equipes.reduce((n, e) => n + e.casas.length, 0);
  assert.equal(p.equipes.reduce((n, e) => n + e.cota, 0), totalCasas);
  for (const e of p.equipes) {
    assert.equal(e.carros, e.membros.filter((x) => x.temCarro).length);
    assert.ok(e.limite >= e.cota);
  }
  assert.ok(p.equipes.every((e) => e.carros === 1));
});

// ---------- equipes manuais e coordenador ----------
test("equipe criada à mão sobrevive a 'Sugerir equipes', com seus membros", async () => {
  const o = await ops();
  const a = await cenarioOps("manual-sug");
  await o.criarEquipe(a.admin, a.missao.id);
  const todas = await db.equipeEvangelizacao.findMany({ where: { missaoId: a.missao.id }, orderBy: { id: "asc" } });
  const manual = todas[todas.length - 1];
  assert.equal(manual.manual, true);
  assert.equal(todas.filter((e) => e.manual).length, 1);
  const servoNaManual = await db.servo.findFirst({ where: { missaoId: a.missao.id, equipeEvangelizacao: { manual: false } } });
  await o.moverServoEquipe(a.admin, servoNaManual!.id, manual.id);
  await o.sugerirEquipes(a.admin, a.missao.id);
  const depois = await db.equipeEvangelizacao.findMany({ where: { missaoId: a.missao.id } });
  assert.ok(depois.some((e) => e.id === manual.id), "equipe manual foi apagada");
  assert.equal((await db.servo.findUnique({ where: { id: servoNaManual!.id } }))!.equipeEvangelizacaoId, manual.id);
  // os 5 servos restantes foram reagrupados em equipes automáticas, ninguém ficou solto
  assert.equal(await db.servo.count({ where: { missaoId: a.missao.id, equipeEvangelizacaoId: null } }), 0);
});

test("trocar membro à mão trava as duas equipes; apagar equipe manual é possível", async () => {
  const o = await ops();
  const a = await cenarioOps("manual-troca");
  const s = (await db.servo.findFirst({ where: { equipeEvangelizacaoId: a.equipes[0].id } }))!;
  await o.moverServoEquipe(a.admin, s.id, a.equipes[1].id);
  const eqs = await db.equipeEvangelizacao.findMany({ where: { missaoId: a.missao.id } });
  assert.ok(eqs.every((e) => e.manual));
  await o.apagarEquipe(a.admin, a.equipes[0].id);
  assert.equal(await db.equipeEvangelizacao.count({ where: { missaoId: a.missao.id } }), 1);
});

test("o sorteio de casas não mexe nas equipes nem nos membros", async () => {
  const o = await ops();
  const a = await cenarioOps("manual-sorteio");
  await o.criarEquipe(a.admin, a.missao.id);
  const antes = await db.servo.findMany({ where: { missaoId: a.missao.id }, orderBy: { id: "asc" }, select: { id: true, equipeEvangelizacaoId: true } });
  const nEquipes = await db.equipeEvangelizacao.count({ where: { missaoId: a.missao.id } });
  await o.rodarSorteio(a.admin, a.missao.id);
  const depois = await db.servo.findMany({ where: { missaoId: a.missao.id }, orderBy: { id: "asc" }, select: { id: true, equipeEvangelizacaoId: true } });
  assert.deepEqual(depois, antes);
  assert.equal(await db.equipeEvangelizacao.count({ where: { missaoId: a.missao.id } }), nEquipes);
});

test("coordenador vinculado à missão opera; coordenador de outra missão é recusado", async () => {
  const o = await ops();
  const a = await cenarioOps("coord-a");
  const b = await cenarioOps("coord-b");
  const c = await db.usuario.create({ data: { nome: "coord", email: "coord-a@x", role: "COORDENADOR", setor: "EVANGELIZAÇÃO" } });
  await db.usuarioMissao.create({ data: { usuarioId: c.id, missaoId: a.missao.id } });
  const coord = { id: c.id, role: "COORDENADOR" };
  await o.marcarTemCarro(coord, a.servo.id, true);
  await o.criarEquipe(coord, a.missao.id);
  await assert.rejects(o.criarEquipe(coord, b.missao.id), /Sem permissão/);
  await assert.rejects(o.marcarTemCarro(coord, b.servo.id, true), /Sem permissão/);
});
