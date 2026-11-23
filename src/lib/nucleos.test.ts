import { test } from "node:test";
import assert from "node:assert/strict";
import { NUCLEOS, nucleoAceito } from "./nucleos";

test("lista com os 15 núcleos, sem repetição", () => {
  assert.equal(NUCLEOS.length, 15);
  assert.equal(new Set(NUCLEOS).size, 15);
  assert.ok(NUCLEOS.includes("EMERGENCIAS") && NUCLEOS.includes("EMERGENCIAS - PADRES"));
  assert.ok(NUCLEOS.includes("PALHOÇA - PONTE DO IMARUIM"));
});

test("nucleoAceito: da lista sim; fora da lista só se já era o valor da ficha", () => {
  assert.equal(nucleoAceito("FLORIANOPOLIS"), true);
  assert.equal(nucleoAceito(" ANGELINA "), true);
  assert.equal(nucleoAceito("Florianópolis"), false); // escrito diferente
  assert.equal(nucleoAceito(""), false);
  assert.equal(nucleoAceito("NÚCLEO ANTIGO", "NÚCLEO ANTIGO"), true); // ficha antiga mantém o que tinha
  assert.equal(nucleoAceito("OUTRO", "NÚCLEO ANTIGO"), false);
});
