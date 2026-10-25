import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTRA, validarFixos, validarRespostas, type PerguntaForm } from "./servirRespostas";

const p = (o: Partial<PerguntaForm> & Pick<PerguntaForm, "id" | "tipo">): PerguntaForm => ({
  titulo: `Pergunta ${o.id}`,
  obrigatoria: false,
  opcoes: [],
  permiteOutra: false,
  ...o,
});

test("obrigatória vazia gera erro e opcional vazia some das respostas", () => {
  const perguntas = [p({ id: 1, tipo: "TEXTO_CURTO", obrigatoria: true }), p({ id: 2, tipo: "TEXTO_CURTO" })];
  const r = validarRespostas(perguntas, { 1: { valores: ["  "] } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.erros[1]);
  const ok = validarRespostas(perguntas, { 1: { valores: ["a"] } });
  assert.deepEqual(ok.ok && ok.respostas.map((x) => x.perguntaId), [1]);
});

test("SIM_NAO só aceita Sim ou Não", () => {
  const perguntas = [p({ id: 1, tipo: "SIM_NAO" })];
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["Sim"] } }).ok, true);
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["Talvez"] } }).ok, false);
});

test("NUMERO aceita 2015 e rejeita abc", () => {
  const perguntas = [p({ id: 1, tipo: "NUMERO" })];
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["2015"] } }).ok, true);
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["abc"] } }).ok, false);
});

test("DATA exige data real no calendário", () => {
  const perguntas = [p({ id: 1, tipo: "DATA" })];
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["2000-02-29"] } }).ok, true);
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["2001-02-29"] } }).ok, false);
});

test("ESCOLHA_UMA rejeita dois valores e valor fora das opções", () => {
  const perguntas = [p({ id: 1, tipo: "ESCOLHA_UMA", opcoes: ["A", "B"] })];
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["A", "B"] } }).ok, false);
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["C"] } }).ok, false);
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["A"] } }).ok, true);
});

test("OUTRA só vale com permiteOutra e guarda o texto aparado", () => {
  const sem = [p({ id: 1, tipo: "ESCOLHA_UMA", opcoes: ["A"] })];
  assert.equal(validarRespostas(sem, { 1: { valores: [OUTRA], outra: "X" } }).ok, false);
  const com = [p({ id: 1, tipo: "ESCOLHA_UMA", opcoes: ["A"], permiteOutra: true })];
  const r = validarRespostas(com, { 1: { valores: [OUTRA], outra: " Paróquia X " } });
  assert.deepEqual(r.ok && r.respostas[0].valor, "Paróquia X");
  assert.equal(validarRespostas(com, { 1: { valores: [OUTRA], outra: "  " } }).ok, false);
});

test("ESCOLHA_VARIAS aceita lista sem repetidos", () => {
  const perguntas = [p({ id: 1, tipo: "ESCOLHA_VARIAS", opcoes: ["A", "B", "C"] })];
  const r = validarRespostas(perguntas, { 1: { valores: ["A", "C"] } });
  assert.deepEqual(r.ok && r.respostas[0].valor, ["A", "C"]);
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["A", "A"] } }).ok, false);
});

test("pergunta fora da lista (desativada) é ignorada mesmo se vier na entrada", () => {
  const r = validarRespostas([p({ id: 1, tipo: "TEXTO_CURTO" })], { 1: { valores: ["a"] }, 99: { valores: ["lixo"] } });
  assert.deepEqual(r.ok && r.respostas.map((x) => x.perguntaId), [1]);
});

test("texto curto de 201 caracteres é recusado", () => {
  const perguntas = [p({ id: 1, tipo: "TEXTO_CURTO" })];
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["a".repeat(201)] } }).ok, false);
  assert.equal(validarRespostas(perguntas, { 1: { valores: ["a".repeat(200)] } }).ok, true);
});

test("resposta guarda título e tipo no momento do envio", () => {
  const r = validarRespostas([p({ id: 7, tipo: "SIM_NAO", titulo: "Participa?" })], { 7: { valores: ["Não"] } });
  assert.deepEqual(r.ok && r.respostas[0], { perguntaId: 7, titulo: "Participa?", tipo: "SIM_NAO", valor: "Não" });
});

const fixos = {
  nome: "maria da silva", cpf: "529.982.247-25", celular: "(48) 99999-0000",
  casado: "Não", conjugeNome: "", conjugeCelular: "", disponivel: "Sim",
};

test("validarFixos normaliza nome e deixa CPF e celular só com dígitos", () => {
  const r = validarFixos(fixos);
  assert.deepEqual(r.ok && r.dados, {
    nome: "Maria da Silva", cpf: "52998224725", celular: "48999990000",
    casado: false, conjugeNome: null, conjugeCelular: null, disponivel: true,
  });
});

test("validarFixos rejeita CPF inválido e celular curto", () => {
  const r = validarFixos({ ...fixos, cpf: "111.111.111-11", celular: "123456789" });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.ok(r.erros.cpf); assert.ok(r.erros.celular); }
  assert.equal(validarFixos({ ...fixos, celular: "48999990000" }).ok, true);
});

test("casado exige nome e celular do cônjuge", () => {
  const r = validarFixos({ ...fixos, casado: "Sim" });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.ok(r.erros.conjugeNome); assert.ok(r.erros.conjugeCelular); }
  const ok = validarFixos({ ...fixos, casado: "Sim", conjugeNome: "joão souza", conjugeCelular: "(48) 98888-1111" });
  assert.deepEqual(ok.ok && [ok.dados.casado, ok.dados.conjugeNome, ok.dados.conjugeCelular], [true, "João Souza", "48988881111"]);
});

test("não casado descarta dados de cônjuge enviados", () => {
  const r = validarFixos({ ...fixos, conjugeNome: "Fulano", conjugeCelular: "48988881111" });
  assert.deepEqual(r.ok && [r.dados.conjugeNome, r.dados.conjugeCelular], [null, null]);
});

test("casado e disponivel só aceitam Sim ou Não", () => {
  assert.equal(validarFixos({ ...fixos, disponivel: "" }).ok, false);
  assert.equal(validarFixos({ ...fixos, casado: "talvez" }).ok, false);
});
