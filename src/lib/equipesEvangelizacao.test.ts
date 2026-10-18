import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveVizinha, type Vizinhanca } from "./cidades";
import { formarEquipes, validarEquipe, type ServoEv } from "./equipesEvangelizacao";

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}
const nenhuma: Vizinhanca = new Set();
const servos = (cidades: (number | null)[], carros: number[] = []): ServoEv[] =>
  cidades.map((cidadeId, i) => ({ id: i + 1, cidadeId, temCarro: carros.includes(i + 1) }));
const porId = (todos: ServoEv[]) => new Map(todos.map((s) => [s.id, s]));

test("9 servos de 3 cidades sem relação formam 3 equipes de uma cidade", () => {
  const todos = servos([1, 2, 3, 1, 2, 3, 1, 2, 3], [1, 2, 3]);
  const { equipes } = formarEquipes(todos, nenhuma, lcg(1));
  assert.equal(equipes.length, 3);
  const m = porId(todos);
  for (const e of equipes) {
    assert.equal(e.length, 3);
    assert.equal(new Set(e.map((id) => m.get(id)!.cidadeId)).size, 1);
  }
});

test("7 servos viram equipes de 3 e 4; 8 viram 4 e 4", () => {
  const t7 = formarEquipes(servos([1, 1, 1, 1, 1, 1, 1], [1, 4]), nenhuma, lcg(1)).equipes;
  assert.deepEqual(t7.map((e) => e.length).sort(), [3, 4]);
  const t8 = formarEquipes(servos([1, 1, 1, 1, 1, 1, 1, 1], [1, 5]), nenhuma, lcg(1)).equipes;
  assert.deepEqual(t8.map((e) => e.length), [4, 4]);
});

test("todos os servos entram em exatamente uma equipe", () => {
  const todos = servos([1, 2, 3, 4, 1, 2, 3, 4, 5, 5], [1]);
  const { equipes } = formarEquipes(todos, nenhuma, lcg(3));
  assert.deepEqual(equipes.flat().sort((a, b) => a - b), todos.map((s) => s.id));
});

test("cidades vizinhas ficam juntas antes de misturar com cidade distante", () => {
  // A=1 e B=2 vizinhas, C=3 e D=4 vizinhas; A,B longe de C,D
  const viz: Vizinhanca = new Set([chaveVizinha(1, 2), chaveVizinha(3, 4)]);
  const todos = servos([1, 3, 1, 3, 2, 4], [1, 2]);
  const { equipes } = formarEquipes(todos, viz, lcg(2));
  const m = porId(todos);
  const conjuntos = equipes.map((e) => [...new Set(e.map((id) => m.get(id)!.cidadeId))].sort());
  assert.deepEqual(conjuntos.sort(), [[1, 2], [3, 4]]);
});

test("com 2 carros e 2 equipes, cada equipe fica com 1 carro", () => {
  const todos = servos([1, 1, 1, 1, 1, 1], [1, 2]);
  const { equipes } = formarEquipes(todos, nenhuma, lcg(1));
  const m = porId(todos);
  for (const e of equipes) assert.equal(e.filter((id) => m.get(id)!.temCarro).length, 1);
});

test("com 1 carro só, uma equipe fica sem carro e é avisada", () => {
  const todos = servos([1, 1, 1, 1, 1, 1], [1]);
  const { equipes } = formarEquipes(todos, nenhuma, lcg(1));
  const m = porId(todos);
  const avisos = equipes.map((e) => validarEquipe(e.map((id) => m.get(id)!), nenhuma));
  assert.equal(avisos.filter((a) => a.includes("SEM_CARRO")).length, 1);
});

test("servo sem cidade nunca divide equipe com cidade conhecida", () => {
  const todos = servos([1, 1, 1, null, null, null], [1, 4]);
  const { equipes } = formarEquipes(todos, nenhuma, lcg(1));
  const m = porId(todos);
  for (const e of equipes) {
    const conhecidas = e.filter((id) => m.get(id)!.cidadeId !== null).length;
    assert.ok(conhecidas === 0 || conhecidas === e.length);
  }
  const semCidade = equipes.find((e) => m.get(e[0])!.cidadeId === null)!;
  assert.ok(validarEquipe(semCidade.map((id) => m.get(id)!), nenhuma).includes("CIDADE_DESCONHECIDA"));
});

test("mesmo rng dá o mesmo resultado", () => {
  const todos = servos([1, 2, 1, 2, 1, 2, 3, 3, 3, 1], [1, 5, 9]);
  const a = formarEquipes(todos, nenhuma, lcg(42));
  const b = formarEquipes(todos, nenhuma, lcg(42));
  assert.deepEqual(a, b);
});

test("sem servos e com poucos servos não quebra", () => {
  assert.deepEqual(formarEquipes([], nenhuma).equipes, []);
  assert.deepEqual(formarEquipes(servos([1, 1]), nenhuma).equipes.map((e) => e.length), [2]);
});

test("validarEquipe avisa tamanho, cidades não vizinhas e falta de carro", () => {
  const viz: Vizinhanca = new Set([chaveVizinha(1, 2)]);
  const ok = servos([1, 2, 1], [1]);
  assert.deepEqual(validarEquipe(ok, viz), []);
  const longe = servos([1, 3, 1], [1]);
  assert.deepEqual(validarEquipe(longe, viz), ["NAO_VIZINHAS"]);
  const pequena = servos([1, 1], [1]);
  assert.deepEqual(validarEquipe(pequena, viz), ["TAMANHO"]);
  const semCarro = servos([1, 1, 1]);
  assert.deepEqual(validarEquipe(semCarro, viz), ["SEM_CARRO"]);
});

test("de 1 a 25 servos, ninguém fica de fora e só a sobra impossível foge de 3–4", () => {
  for (let n = 1; n <= 25; n++) {
    const todos = servos(Array.from({ length: n }, (_, i) => (i % 3) + 1), [1, 2, 3]);
    const { equipes } = formarEquipes(todos, nenhuma, lcg(n));
    assert.deepEqual(equipes.flat().sort((a, b) => a - b), todos.map((s) => s.id), `n=${n}`);
    if (n >= 6) assert.ok(equipes.every((e) => e.length === 3 || e.length === 4), `n=${n}`);
  }
});
