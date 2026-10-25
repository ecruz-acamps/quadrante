import { test } from "node:test";
import assert from "node:assert/strict";
import { ligarConjuges, type CandidatoConjuge } from "./servirConjuge";

const c = (id: number, nome: string, celular: string, extra: Partial<CandidatoConjuge> = {}): CandidatoConjuge => ({
  id, nome, celular, casado: false, conjugeNome: null, conjugeCelular: null, ...extra,
});

test("celular do cônjuge informado por A bate com o de B: ligados nos dois sentidos", () => {
  const a = c(1, "Ana Lima", "48911110000", { casado: true, conjugeNome: "Bruno Lima", conjugeCelular: "48922220000" });
  const b = c(2, "Bruno Lima", "48922220000"); // B nem marcou casado
  const m = ligarConjuges([a, b]);
  assert.equal(m.get(1), 2);
  assert.equal(m.get(2), 1);
});

test("só o nome bate (sem acento e sem diferença de maiúsculas)", () => {
  const a = c(1, "Ana Lima", "48911110000", { casado: true, conjugeNome: "José Silva", conjugeCelular: "48900000001" });
  const b = c(2, "jose silva", "48933330000");
  assert.equal(ligarConjuges([a, b]).get(1), 2);
});

test("A e B apontando um para o outro formam um único par", () => {
  const a = c(1, "Ana", "48911110000", { casado: true, conjugeNome: "Bruno", conjugeCelular: "48922220000" });
  const b = c(2, "Bruno", "48922220000", { casado: true, conjugeNome: "Ana", conjugeCelular: "48911110000" });
  const m = ligarConjuges([a, b]);
  assert.equal(m.size, 2);
  assert.equal(m.get(1), 2);
  assert.equal(m.get(2), 1);
});

test("celular do cônjuge igual ao de dois candidatos: não liga por celular, mas o nome ainda resolve", () => {
  const a = c(1, "Ana Lima", "48911110000", { casado: true, conjugeNome: "Bruno Lima", conjugeCelular: "48922220000" });
  const b = c(2, "Bruno Lima", "48922220000");
  const x = c(3, "Carlos Souza", "48922220000");
  const m = ligarConjuges([a, b, x]);
  assert.equal(m.get(1), 2);
  assert.equal(m.has(3), false);
});

test("sem nome que desempate, celular ambíguo não liga ninguém", () => {
  const a = c(1, "Ana Lima", "48911110000", { casado: true, conjugeNome: "Fulano", conjugeCelular: "48922220000" });
  const b = c(2, "Beto", "48922220000");
  const x = c(3, "Caio", "48922220000");
  assert.equal(ligarConjuges([a, b, x]).size, 0);
});

test("candidato não casado e ninguém apontando para ele fica fora do mapa", () => {
  assert.equal(ligarConjuges([c(1, "Ana", "48911110000"), c(2, "Beto", "48922220000")]).size, 0);
});

test("um candidato nunca liga consigo mesmo", () => {
  const a = c(1, "Ana Lima", "48911110000", { casado: true, conjugeNome: "Ana Lima", conjugeCelular: "48911110000" });
  assert.equal(ligarConjuges([a]).size, 0);
});
