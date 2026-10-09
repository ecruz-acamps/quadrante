import { test } from "node:test";
import assert from "node:assert/strict";
import { brl, decimal } from "./format";

// Intl usa espaço inseparável (U+00A0) entre "R$" e o valor; normaliza para comparar
const n = (s: string) => s.replace(/ /g, " ");

test("brl formata com milhar e vírgula", () => {
  assert.equal(n(brl(1234.5)), "R$ 1.234,50");
  assert.equal(n(brl(0)), "R$ 0,00");
  assert.equal(n(brl(24000)), "R$ 24.000,00");
  assert.equal(n(brl(36600)), "R$ 36.600,00");
});

test("brl arredonda para centavos sem erro de ponto flutuante", () => {
  assert.equal(n(brl(0.1 + 0.2)), "R$ 0,30");
  assert.equal(n(brl(1.005 * 100)), "R$ 100,50");
});

test("brl trata valores inválidos como zero em vez de mostrar NaN", () => {
  assert.equal(n(brl(NaN)), "R$ 0,00");
  assert.equal(n(brl(Infinity)), "R$ 0,00");
});

test("decimal usa vírgula e o número de casas pedido", () => {
  assert.equal(decimal(1.75, 2), "1,75");
  assert.equal(decimal(70, 0), "70");
  assert.equal(decimal(1234.5, 1), "1.234,5");
  assert.equal(decimal(NaN, 2), "0,00");
});
