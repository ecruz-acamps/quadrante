import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarBancoTemporario } from "./testdb";

const banco = criarBancoTemporario();
process.env.DATABASE_URL = banco.url;

type Db = typeof import("./db").db;
let db: Db;
let m: typeof import("./servirPerguntasDb");

before(async () => {
  db = (await import("./db")).db;
  m = await import("./servirPerguntasDb");
});
after(async () => {
  await db?.$disconnect();
  banco.limpar();
});

const dados = (o: Partial<import("./servirPerguntasDb").DadosPergunta> = {}) => ({
  titulo: "Pergunta nova", tipo: "TEXTO_CURTO" as const, obrigatoria: false, opcoes: [] as string[], permiteOutra: false, ...o,
});

test("garantirPerguntasIniciais cria as 8 perguntas do Forms e é idempotente", async () => {
  await m.garantirPerguntasIniciais(db);
  await m.garantirPerguntasIniciais(db);
  const todas = await m.listarPerguntasAtivas(db);
  assert.equal(todas.length, 8);
  assert.deepEqual(todas.map((p) => p.tipo), [
    "DATA", "SIM_NAO", "ESCOLHA_UMA", "ESCOLHA_VARIAS", "ESCOLHA_UMA", "SIM_NAO", "TEXTO_CURTO", "NUMERO",
  ]);
  const paroquia = todas[4];
  assert.equal(paroquia.permiteOutra, true);
  assert.equal(paroquia.obrigatoria, true);
  assert.ok(Array.isArray(paroquia.opcoes) && paroquia.opcoes.includes("Paróquia Santo Amaro"));
  assert.ok(todas[3].opcoes.includes("Nunca fui servo"));
  assert.ok(todas[2].opcoes.includes("23º Sênior"));
});

test("moverPergunta troca com a vizinha e na primeira não faz nada", async () => {
  const antes = (await m.listarPerguntasAtivas(db)).map((p) => p.id);
  await m.moverPergunta(db, antes[1], "cima");
  const depois = (await m.listarPerguntasAtivas(db)).map((p) => p.id);
  assert.deepEqual(depois.slice(0, 2), [antes[1], antes[0]]);
  await m.moverPergunta(db, depois[0], "cima");
  assert.deepEqual((await m.listarPerguntasAtivas(db)).map((p) => p.id), depois);
});

test("definirPerguntaAtiva(false) tira do formulário mas mantém na lista do admin", async () => {
  const id = (await m.listarPerguntasAtivas(db))[0].id;
  await m.definirPerguntaAtiva(db, id, false);
  assert.ok(!(await m.listarPerguntasAtivas(db)).some((p) => p.id === id));
  const admin = await m.listarPerguntasAdmin(db);
  assert.equal(admin.find((p) => p.id === id)?.ativa, false);
  await m.definirPerguntaAtiva(db, id, true);
});

test("criarPergunta põe no fim e valida título e opções", async () => {
  const r = await m.criarPergunta(db, dados({ titulo: "Camiseta?", tipo: "ESCOLHA_UMA", opcoes: [" P ", "M", "M", ""] }));
  assert.equal(r.ok, true);
  const ultima = (await m.listarPerguntasAtivas(db)).at(-1)!;
  assert.equal(ultima.titulo, "Camiseta?");
  assert.deepEqual(ultima.opcoes, ["P", "M"]);
  assert.equal((await m.criarPergunta(db, dados({ tipo: "ESCOLHA_UMA", opcoes: [] }))).ok, false);
  assert.equal((await m.criarPergunta(db, dados({ titulo: "   " }))).ok, false);
});

test("atualizarPergunta não troca o tipo de pergunta que já tem respostas", async () => {
  const comResp = await m.criarPergunta(db, dados({ titulo: "Com respostas" }));
  const semResp = await m.criarPergunta(db, dados({ titulo: "Sem respostas" }));
  assert.ok(comResp.ok && semResp.ok);
  const missao = await db.missao.create({ data: { nome: "m", tipo: "SENIOR", ano: 1, cercoSlug: "m-perg" } });
  await db.candidato.create({
    data: {
      missaoId: missao.id, nome: "A", celular: "48999990000", cpf: "52998224725", disponivel: true,
      respostas: JSON.stringify([{ perguntaId: (comResp as { id: number }).id, titulo: "Com respostas", tipo: "TEXTO_CURTO", valor: "x" }]),
    },
  });
  const id1 = (comResp as { id: number }).id;
  const id2 = (semResp as { id: number }).id;
  assert.equal((await m.atualizarPergunta(db, id1, dados({ titulo: "Com respostas", tipo: "NUMERO" }))).ok, false);
  assert.equal((await m.atualizarPergunta(db, id1, dados({ titulo: "Novo título" }))).ok, true);
  assert.equal((await m.atualizarPergunta(db, id2, dados({ titulo: "Sem respostas", tipo: "NUMERO" }))).ok, true);
  const admin = await m.listarPerguntasAdmin(db);
  assert.equal(admin.find((p) => p.id === id1)?.temRespostas, true);
  assert.equal(admin.find((p) => p.id === id2)?.temRespostas, false);
});
