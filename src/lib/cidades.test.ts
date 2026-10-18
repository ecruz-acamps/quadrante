import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarCidade, resolverCidade, chaveVizinha, saoVizinhas } from "./cidades";

test("normaliza grafias de Palhoça para a mesma chave", () => {
  assert.equal(normalizarCidade("PALHOÇA"), "palhoca");
  assert.equal(normalizarCidade("Palhoça - SC"), "palhoca");
  assert.equal(normalizarCidade("palhoca"), "palhoca");
});

test("normaliza pontuação e espaços", () => {
  assert.equal(normalizarCidade("Sto Amaro Imp. - SC"), "sto amaro imp");
  assert.equal(normalizarCidade("  Florianopolis "), "florianopolis");
  assert.equal(normalizarCidade("Palhoça/SC"), "palhoca");
});

test("remove o sufixo SC mesmo sem hífen", () => {
  assert.equal(normalizarCidade("Sto Amaro Imp. SC"), "sto amaro imp");
  assert.equal(normalizarCidade("Palhoça SC"), "palhoca");
  assert.equal(normalizarCidade("Sc"), "sc");
});

test("resolverCidade usa o mapa de apelidos", () => {
  const mapa = new Map([["palhoca", 1]]);
  assert.equal(resolverCidade("Palhoça - SC", mapa), 1);
  assert.equal(resolverCidade("Xyz", mapa), null);
  assert.equal(resolverCidade("", mapa), null);
  assert.equal(resolverCidade(null, mapa), null);
  assert.equal(resolverCidade(undefined, mapa), null);
});

test("chaveVizinha ordena e saoVizinhas é simétrica", () => {
  assert.equal(chaveVizinha(5, 2), "2-5");
  const v = new Set([chaveVizinha(2, 5)]);
  assert.equal(saoVizinhas(v, 5, 2), true);
  assert.equal(saoVizinhas(v, 2, 5), true);
  assert.equal(saoVizinhas(v, 2, 3), false);
  assert.equal(saoVizinhas(v, null, 2), false);
  assert.equal(saoVizinhas(v, 2, null), false);
});
