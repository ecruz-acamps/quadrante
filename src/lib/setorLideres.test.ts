import { test } from "node:test";
import assert from "node:assert/strict";
import { ehSetorLideres } from "./setorLideres";

test("reconhece o setor LÍDERES com ou sem acento e em qualquer caixa", () => {
  for (const s of ["LÍDERES", "LIDERES", "Líderes", " lideres "]) assert.equal(ehSetorLideres(s), true, s);
});

test("outros setores não são o setor LÍDERES", () => {
  for (const s of ["MÚSICA", "COORDENADORES DA MISSÃO", "LÍDER", "LIDERES DE TRIBO", ""]) assert.equal(ehSetorLideres(s), false, s);
});
