import { test } from "node:test";
import assert from "node:assert/strict";
import { valorServo } from "./valorServo";

const missao = { valorInterna: 160, valorExterna: 80 };
const v = (setor: string, funcao: string, extra: { pagamentoValor?: number | null; pagamentoForma?: string | null } = {}) =>
  valorServo({ setor, funcao, ...extra }, missao);

test("pregador é isento sempre", () => {
  assert.equal(v("CONDUÇÃO/PREGADOR", "COORDENADOR"), 0);
  assert.equal(v("CONDUÇÃO/PREGADOR", "INTEGRANTE"), 0);
});

test("evangelização paga 80 em qualquer função", () => {
  for (const f of ["COORDENADOR", "AUXILIAR", "APOIO", "INTEGRANTE"]) assert.equal(v("EVANGELIZAÇÃO", f), 80);
});

test("líderes: integrante 80; coordenador, auxiliar e apoio 160", () => {
  assert.equal(v("LÍDERES", "INTEGRANTE"), 80);
  for (const f of ["COORDENADOR", "AUXILIAR", "APOIO"]) assert.equal(v("LÍDERES", f), 160);
});

test("demais setores pagam 160", () => {
  assert.equal(v("COZINHA", "INTEGRANTE"), 160);
  assert.equal(v("COZINHA", "COORDENADOR"), 160);
});

test("ignora caixa, acento e espaços no nome do setor", () => {
  assert.equal(v(" evangelizacao ", "INTEGRANTE"), 80);
  assert.equal(v("Líderes", "INTEGRANTE"), 80);
});

test("valor digitado à mão tem prioridade sobre a regra", () => {
  assert.equal(v("COZINHA", "INTEGRANTE", { pagamentoValor: 100 }), 100);
  assert.equal(v("CONDUÇÃO/PREGADOR", "INTEGRANTE", { pagamentoValor: 50 }), 50);
});

test("forma ISENTO zera o valor", () => {
  assert.equal(v("COZINHA", "INTEGRANTE", { pagamentoForma: "ISENTO" }), 0);
});

test("valores vêm da missão", () => {
  assert.equal(valorServo({ setor: "COZINHA", funcao: "INTEGRANTE" }, { valorInterna: 200, valorExterna: 90 }), 200);
  assert.equal(valorServo({ setor: "EVANGELIZAÇÃO", funcao: "INTEGRANTE" }, { valorInterna: 200, valorExterna: 90 }), 90);
});
