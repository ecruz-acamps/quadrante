import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveVizinha, type Vizinhanca } from "./cidades";
import { sortearCasas, validarCasa, type CasaSorteio, type EquipeSorteio } from "./sorteioCasas";

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}
// Palhoça=1, São José=2, Santo Amaro=3, Biguaçu=4; vizinhança 1–2, 1–3, 2–3, 2–4
const PAL = 1, SJ = 2, SA = 3, BIG = 4;
const viz: Vizinhanca = new Set([[1, 2], [1, 3], [2, 3], [2, 4]].map(([a, b]) => chaveVizinha(a, b)));
const eq = (id: number, cidades: (number | null)[]): EquipeSorteio => ({ id, cidades });
const casa = (id: number, cidadeId: number | null, extra: Partial<CasaSorteio> = {}): CasaSorteio => ({
  id, cidadeId, bairro: null, fixadaEm: null, ...extra,
});
const carga = (alocacao: Map<number, number>, equipeId: number) =>
  [...alocacao.values()].filter((e) => e === equipeId).length;

test("casa de Palhoça nunca vai para equipe com membro de Palhoça", () => {
  const equipes = [eq(1, [PAL, PAL, SJ]), eq(2, [BIG, BIG, BIG])];
  const casas = Array.from({ length: 6 }, (_, i) => casa(i + 1, PAL));
  const r = sortearCasas(equipes, casas, viz, lcg(1));
  for (const [, equipeId] of r.alocacao) assert.equal(equipeId, 2);
  assert.equal(r.alocacao.size, 6);
});

test("prefere equipe de cidade vizinha quando as duas têm vaga", () => {
  const equipes = [eq(1, [BIG, BIG, BIG]), eq(2, [SJ, SJ, SJ])];
  for (let seed = 1; seed <= 10; seed++) {
    const r = sortearCasas(equipes, [casa(1, PAL)], viz, lcg(seed));
    assert.equal(r.alocacao.get(1), 2);
  }
});

test("equilibra casas entre equipes permitidas", () => {
  const equipes = [eq(1, [SJ, SJ, SJ]), eq(2, [SJ, SJ, SJ])];
  const oito = sortearCasas(equipes, Array.from({ length: 8 }, (_, i) => casa(i + 1, PAL)), viz, lcg(1));
  assert.deepEqual([carga(oito.alocacao, 1), carga(oito.alocacao, 2)], [4, 4]);
  const sete = sortearCasas(equipes, Array.from({ length: 7 }, (_, i) => casa(i + 1, PAL)), viz, lcg(1));
  assert.deepEqual([carga(sete.alocacao, 1), carga(sete.alocacao, 2)].sort(), [3, 4]);
  const tres = sortearCasas(equipes, Array.from({ length: 3 }, (_, i) => casa(i + 1, PAL)), viz, lcg(1));
  assert.ok(carga(tres.alocacao, 1) <= 2 && carga(tres.alocacao, 2) <= 2);
});

test("equipe com membro de cidade desconhecida não recebe casa", () => {
  const equipes = [eq(1, [SJ, null, SJ]), eq(2, [BIG, BIG, BIG])];
  assert.equal(validarCasa(equipes[0], PAL), "CIDADE_DESCONHECIDA");
  const r = sortearCasas(equipes, [casa(1, PAL), casa(2, PAL), casa(3, SA)], viz, lcg(1));
  for (const [, equipeId] of r.alocacao) assert.equal(equipeId, 2);
});

test("validarCasa distingue OK, IMPEDIDA e cidade desconhecida", () => {
  const e = eq(1, [PAL, SJ, SJ]);
  assert.equal(validarCasa(e, BIG), "OK");
  assert.equal(validarCasa(e, PAL), "IMPEDIDA");
  assert.equal(validarCasa(e, null), "CIDADE_DESCONHECIDA");
});

test("casa sem cidade e casa impedida em todas as equipes vão para pendências", () => {
  const equipes = [eq(1, [PAL, PAL, PAL]), eq(2, [PAL, SJ, SJ])];
  const r = sortearCasas(equipes, [casa(1, null), casa(2, PAL), casa(3, BIG)], viz, lcg(1));
  assert.deepEqual(
    r.pendencias.sort((a, b) => a.casaId - b.casaId),
    [
      { casaId: 1, motivo: "SEM_CIDADE" },
      { casaId: 2, motivo: "SEM_EQUIPE_PERMITIDA" },
    ]
  );
  assert.equal(r.alocacao.get(3) !== undefined, true);
});

test("casa fixada fica na equipe mesmo violando o impedimento", () => {
  const equipes = [eq(7, [PAL, PAL, PAL]), eq(8, [BIG, BIG, BIG])];
  const r = sortearCasas(equipes, [casa(1, PAL, { fixadaEm: 7 }), casa(2, SJ)], viz, lcg(1));
  assert.equal(r.alocacao.get(1), 7);
});

test("zero equipes elegíveis manda tudo para pendências sem erro", () => {
  const r = sortearCasas([], [casa(1, PAL), casa(2, SJ)], viz, lcg(1));
  assert.equal(r.alocacao.size, 0);
  assert.equal(r.pendencias.length, 2);
  const r2 = sortearCasas([eq(1, [null, SJ, SJ])], [casa(1, PAL)], viz, lcg(1));
  assert.deepEqual(r2.pendencias, [{ casaId: 1, motivo: "SEM_EQUIPE_PERMITIDA" }]);
});

test("mesmo rng repete o resultado e rngs diferentes podem variar nos empates", () => {
  const equipes = [eq(1, [BIG, BIG, BIG]), eq(2, [BIG, BIG, BIG]), eq(3, [BIG, BIG, BIG])];
  const casas = Array.from({ length: 9 }, (_, i) => casa(i + 1, PAL));
  const a = sortearCasas(equipes, casas, viz, lcg(5));
  const b = sortearCasas(equipes, casas, viz, lcg(5));
  assert.deepEqual([...a.alocacao], [...b.alocacao]);
  const distintos = new Set(
    Array.from({ length: 20 }, (_, s) => JSON.stringify([...sortearCasas(equipes, casas, viz, lcg(s + 100)).alocacao]))
  );
  assert.ok(distintos.size > 1);
});

test("mais casas que 4 por equipe lista as equipes acima do limite", () => {
  const equipes = [eq(1, [BIG, BIG, BIG]), eq(2, [BIG, BIG, BIG])];
  const casas = Array.from({ length: 11 }, (_, i) => casa(i + 1, PAL));
  const r = sortearCasas(equipes, casas, viz, lcg(1));
  assert.equal(r.alocacao.size, 11);
  assert.deepEqual(r.equipesAcimaDoLimite.sort(), [1, 2].filter((id) => carga(r.alocacao, id) > 4));
  assert.ok(r.equipesAcimaDoLimite.length >= 1);
});

test("com casas fixadas contam na carga: o resto se distribui em volta delas", () => {
  const equipes = [eq(1, [BIG, BIG, BIG]), eq(2, [BIG, BIG, BIG])];
  const casas = [
    casa(1, PAL, { fixadaEm: 1 }), casa(2, PAL, { fixadaEm: 1 }), casa(3, PAL, { fixadaEm: 1 }),
    ...Array.from({ length: 4 }, (_, i) => casa(i + 4, PAL)),
  ];
  const r = sortearCasas(equipes, casas, viz, lcg(1));
  assert.deepEqual([carga(r.alocacao, 1), carga(r.alocacao, 2)].sort(), [3, 4]);
  for (const id of [1, 2, 3]) assert.equal(r.alocacao.get(id), 1);
});

test("sem restrições, a carga das equipes nunca difere em mais de 1 (3E <= N <= 4E)", () => {
  const bairros = ["Centro", "Centro", "Barra", "Pagani", null];
  for (let seed = 1; seed <= 300; seed++) {
    const rng = lcg(seed);
    const E = 2 + Math.floor(rng() * 7);
    const N = 3 * E + Math.floor(rng() * (E + 1));
    const equipes = Array.from({ length: E }, (_, i) => eq(i + 1, [BIG, BIG, BIG]));
    const casas = Array.from({ length: N }, (_, i) =>
      casa(i + 1, rng() < 0.7 ? PAL : SA, { bairro: bairros[Math.floor(rng() * bairros.length)] })
    );
    const r = sortearCasas(equipes, casas, viz, lcg(seed + 1000));
    const cargas = equipes.map((e) => carga(r.alocacao, e.id));
    assert.ok(Math.max(...cargas) - Math.min(...cargas) <= 1, `E=${E} N=${N} cargas=${cargas}`);
  }
});
