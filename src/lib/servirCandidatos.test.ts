import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarBancoTemporario } from "./testdb";
import type { DadosFixos } from "./servirRespostas";

const banco = criarBancoTemporario();
process.env.DATABASE_URL = banco.url;

type Db = typeof import("./db").db;
let db: Db;
let m: typeof import("./servirCandidatos");
let n = 0;

before(async () => {
  db = (await import("./db")).db;
  m = await import("./servirCandidatos");
});
after(async () => {
  await db?.$disconnect();
  banco.limpar();
});

const novaMissao = (extra: { mes?: number; anoCalendario?: number } = {}) =>
  db.missao.create({ data: { nome: `Missão ${++n}`, tipo: "SENIOR", ano: 1, cercoSlug: `s-${n}`, ...extra } });

const fixos = (o: Partial<DadosFixos> = {}): DadosFixos => ({
  nome: "Maria Da Silva", cpf: "52998224725", celular: "48999990000",
  casado: false, conjugeNome: null, conjugeCelular: null, disponivel: true, ...o,
});

test("registrarCandidato: mesmo CPF na mesma missão atualiza e não duplica", async () => {
  const mi = await novaMissao();
  assert.deepEqual(await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos(), respostas: [] }), { novo: true });
  assert.deepEqual(await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos({ celular: "48911112222" }), respostas: [] }), { novo: false });
  const todos = await db.candidato.findMany({ where: { missaoId: mi.id } });
  assert.equal(todos.length, 1);
  assert.equal(todos[0].celular, "48911112222");
});

test("registrarCandidato: reenvio de APROVADO mantém status e servoId; RECUSADO volta a PENDENTE", async () => {
  const mi = await novaMissao();
  await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos(), respostas: [] });
  const c = await db.candidato.findFirstOrThrow({ where: { missaoId: mi.id } });
  await db.candidato.update({ where: { id: c.id }, data: { status: "APROVADO", servoId: 123 } });
  await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos({ celular: "48922223333" }), respostas: [] });
  const apos = await db.candidato.findUniqueOrThrow({ where: { id: c.id } });
  assert.deepEqual([apos.status, apos.servoId, apos.celular], ["APROVADO", 123, "48922223333"]);

  await db.candidato.update({ where: { id: c.id }, data: { status: "RECUSADO", servoId: null } });
  await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos(), respostas: [] });
  assert.equal((await db.candidato.findUniqueOrThrow({ where: { id: c.id } })).status, "PENDENTE");
});

test("registrarCandidato: mesmo CPF em missões diferentes são candidatos diferentes", async () => {
  const a = await novaMissao();
  const b = await novaMissao();
  await m.registrarCandidato(db, { missaoId: a.id, fixos: fixos(), respostas: [] });
  await m.registrarCandidato(db, { missaoId: b.id, fixos: fixos(), respostas: [] });
  assert.equal(await db.candidato.count({ where: { cpf: "52998224725", missaoId: { in: [a.id, b.id] } } }), 2);
});

test("pessoasParecidas: acha por CPF com pontuação, nome sem acento/caixa e celular; ignora CPF zerado", async () => {
  const porCpf = await db.pessoa.create({ data: { nome: "Fulana De Tal", cpf: "529.982.247-25" } });
  const porNome = await db.pessoa.create({ data: { nome: "Joana Conceição", cpf: "000.000.000-00" } });
  const porCel = await db.pessoa.create({ data: { nome: "Outra Pessoa", celular: "(48) 97777-1234" } });
  const zerada = await db.pessoa.create({ data: { nome: "Sem Relação", cpf: "000.000.000-00" } });

  const r = await m.pessoasParecidas(db, { cpf: "52998224725", nome: "joana conceicao", celular: "48977771234" });
  const por = new Map(r.map((p) => [p.id, p.motivo]));
  assert.equal(por.get(porCpf.id), "cpf");
  assert.equal(por.get(porNome.id), "nome");
  assert.equal(por.get(porCel.id), "celular");
  assert.equal(por.has(zerada.id), false);
});

test("aprovarCandidato: pessoaId null cria Pessoa e Servo e marca APROVADO; segunda vez recusa", async () => {
  const mi = await novaMissao();
  await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos({ cpf: "11144477735", nome: "Paulo Novo" }), respostas: [] });
  const c = await db.candidato.findFirstOrThrow({ where: { missaoId: mi.id } });
  const r = await m.aprovarCandidato(db, c.id, { setor: "COZINHA", pessoaId: null, codigoLiberacao: null });
  assert.equal(r.ok, true);
  const servo = await db.servo.findFirstOrThrow({ where: { missaoId: mi.id }, include: { pessoa: true } });
  assert.deepEqual([servo.setor, servo.funcao, servo.status, servo.confirmado, servo.pessoa.nome], ["COZINHA", "INTEGRANTE", "ATIVO", false, "Paulo Novo"]);
  assert.equal((await db.candidato.findUniqueOrThrow({ where: { id: c.id } })).status, "APROVADO");
  const de_novo = await m.aprovarCandidato(db, c.id, { setor: "COZINHA", pessoaId: null, codigoLiberacao: null });
  assert.equal(de_novo.ok, false);
  assert.equal(await db.servo.count({ where: { missaoId: mi.id } }), 1);
});

test("aprovarCandidato: indisponível não vira servo", async () => {
  const mi = await novaMissao();
  await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos({ cpf: "39053344705", disponivel: false }), respostas: [] });
  const c = await db.candidato.findFirstOrThrow({ where: { missaoId: mi.id } });
  const r = await m.aprovarCandidato(db, c.id, { setor: "TROPA", pessoaId: null, codigoLiberacao: null });
  assert.equal(r.ok, false);
  assert.equal(await db.servo.count({ where: { missaoId: mi.id } }), 0);
});

test("aprovarCandidato: pessoa que já é servo da missão devolve erro com o setor", async () => {
  const mi = await novaMissao();
  const p = await db.pessoa.create({ data: { nome: "Já Servo" } });
  await db.servo.create({ data: { missaoId: mi.id, pessoaId: p.id, setor: "CAPELA" } });
  await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos({ cpf: "86288366757" }), respostas: [] });
  const c = await db.candidato.findFirstOrThrow({ where: { missaoId: mi.id } });
  const r = await m.aprovarCandidato(db, c.id, { setor: "TROPA", pessoaId: p.id, codigoLiberacao: null });
  assert.equal(r.ok, false);
  assert.match(!r.ok && "erro" in r ? r.erro : "", /CAPELA/);
});

test("aprovarCandidato: conflito de missões próximas exige código de liberação", async () => {
  const origem = await novaMissao({ mes: 1, anoCalendario: 2027 });
  const destino = await novaMissao({ mes: 2, anoCalendario: 2027 });
  const p = await db.pessoa.create({ data: { nome: "Conflito Pessoa" } });
  await db.servo.create({ data: { missaoId: origem.id, pessoaId: p.id, setor: "TROPA", status: "ATIVO" } });
  await m.registrarCandidato(db, { missaoId: destino.id, fixos: fixos({ cpf: "12345678909" }), respostas: [] });
  const c = await db.candidato.findFirstOrThrow({ where: { missaoId: destino.id } });

  const sem = await m.aprovarCandidato(db, c.id, { setor: "TROPA", pessoaId: p.id, codigoLiberacao: null });
  assert.equal(sem.ok, false);
  assert.ok(!sem.ok && "conflito" in sem && sem.conflito.missaoConflitoNome === origem.nome);

  const errado = await m.aprovarCandidato(db, c.id, { setor: "TROPA", pessoaId: p.id, codigoLiberacao: "000000" });
  assert.equal(errado.ok, false);
  assert.ok(!errado.ok && "erro" in errado);

  await db.liberacaoConflitoServo.create({
    data: { pessoaId: p.id, missaoId: destino.id, codigo: "123456", expiraEm: new Date(Date.now() + 60_000) },
  });
  const com = await m.aprovarCandidato(db, c.id, { setor: "TROPA", pessoaId: p.id, codigoLiberacao: "123456" });
  assert.equal(com.ok, true);
});

test("definirStatusCandidato: recusa e reabre, mas não mexe em APROVADO", async () => {
  const mi = await novaMissao();
  await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos({ cpf: "98765432100" }), respostas: [] });
  const c = await db.candidato.findFirstOrThrow({ where: { missaoId: mi.id } });
  assert.equal((await m.definirStatusCandidato(db, c.id, "RECUSADO")).ok, true);
  assert.equal((await db.candidato.findUniqueOrThrow({ where: { id: c.id } })).status, "RECUSADO");
  assert.equal((await m.definirStatusCandidato(db, c.id, "PENDENTE")).ok, true);
  await db.candidato.update({ where: { id: c.id }, data: { status: "APROVADO" } });
  assert.equal((await m.definirStatusCandidato(db, c.id, "RECUSADO")).ok, false);
});

test("historicoDaPessoa lista missão, setor e status dos servos da pessoa", async () => {
  const a = await novaMissao();
  const p = await db.pessoa.create({ data: { nome: "Histórico" } });
  await db.servo.create({ data: { missaoId: a.id, pessoaId: p.id, setor: "MÚSICA", status: "ATIVO" } });
  assert.deepEqual(await m.historicoDaPessoa(db, p.id), [{ missao: a.nome, setor: "MÚSICA", status: "ATIVO" }]);
});

test("aprovarCandidato: duas aprovações simultâneas criam um só Servo e uma só Pessoa", async () => {
  const mi = await novaMissao();
  await m.registrarCandidato(db, { missaoId: mi.id, fixos: fixos({ cpf: "45317828791", nome: "Corrida Dupla" }), respostas: [] });
  const c = await db.candidato.findFirstOrThrow({ where: { missaoId: mi.id } });
  const pessoasAntes = await db.pessoa.count({ where: { nome: "Corrida Dupla" } });
  const [a, b] = await Promise.all([
    m.aprovarCandidato(db, c.id, { setor: "COZINHA", pessoaId: null, codigoLiberacao: null }),
    m.aprovarCandidato(db, c.id, { setor: "COZINHA", pessoaId: null, codigoLiberacao: null }),
  ]);
  assert.equal([a, b].filter((r) => r.ok).length, 1);
  assert.equal(await db.servo.count({ where: { missaoId: mi.id } }), 1);
  assert.equal(await db.pessoa.count({ where: { nome: "Corrida Dupla" } }) - pessoasAntes, 1);
  const apos = await db.candidato.findUniqueOrThrow({ where: { id: c.id } });
  assert.equal(apos.status, "APROVADO");
  assert.ok(apos.servoId);
});

test("pessoasParecidas com missaoId informa o setor de quem já é servo naquela missão", async () => {
  const mi = await novaMissao();
  const p = await db.pessoa.create({ data: { nome: "Quem Já Serve Aqui", celular: "48955554444" } });
  const outra = await db.pessoa.create({ data: { nome: "Outra Pessoa Celular", celular: "48955554444" } });
  await db.servo.create({ data: { missaoId: mi.id, pessoaId: p.id, setor: "CAPELA" } });
  const r = await m.pessoasParecidas(db, { cpf: "00000000000", nome: "Quem Já Serve Aqui", celular: "48955554444" }, mi.id);
  assert.equal(r.find((x) => x.id === p.id)?.setorNaMissao, "CAPELA");
  assert.equal(r.find((x) => x.id === outra.id)?.setorNaMissao, null);
});
