import { test } from "node:test";
import assert from "node:assert/strict";
import { cpfReal, cpfValido, soDigitos } from "./cpf";

test("cpfValido aceita CPF com pontuação ou espaços", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido(" 52998224725 "), true);
});

test("cpfValido rejeita dígito verificador errado, repetido e curto", () => {
  assert.equal(cpfValido("529.982.247-24"), false);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(cpfValido("123"), false);
});

test("cpfReal rejeita zerado e vazio, aceita 11 dígitos variados", () => {
  assert.equal(cpfReal("000.000.000-00"), false);
  assert.equal(cpfReal(null), false);
  assert.equal(cpfReal("529.982.247-24"), true);
});

test("soDigitos remove tudo que não é dígito", () => {
  assert.equal(soDigitos("(48) 99999-0000"), "48999990000");
});
