import { test } from "node:test";
import assert from "node:assert/strict";
import { statusValido, podeMarcarServo, dadosDoStatus, normalizarRole, camisetaValida, podeUsarEvangelizacao, rotaPermitidaServoSecretaria, MOTIVO_MAX } from "./coordenador";

test("statusValido aceita só os três status exatos", () => {
  for (const s of ["ATIVO", "RECUSOU", "DESISTIU"]) assert.equal(statusValido(s), true);
  for (const s of ["ativo", "", "SIM", "NAO", null, undefined, 1, {}]) assert.equal(statusValido(s), false);
});

test("podeMarcarServo: mesmo setor e missão vinculada", () => {
  const c = { setor: "TROPA", missaoIds: [98, 95] };
  assert.equal(podeMarcarServo(c, { setor: "TROPA", missaoId: 98 }), true);
  assert.equal(podeMarcarServo(c, { setor: "TROPA", missaoId: 95 }), true);
});

test("podeMarcarServo: recusa outro setor, outra missão, setor nulo e sem missões", () => {
  assert.equal(podeMarcarServo({ setor: "TROPA", missaoIds: [98] }, { setor: "SECRETARIA", missaoId: 98 }), false);
  assert.equal(podeMarcarServo({ setor: "TROPA", missaoIds: [98] }, { setor: "TROPA", missaoId: 12 }), false);
  assert.equal(podeMarcarServo({ setor: null, missaoIds: [98] }, { setor: "TROPA", missaoId: 98 }), false);
  assert.equal(podeMarcarServo({ setor: "TROPA", missaoIds: [] }, { setor: "TROPA", missaoId: 98 }), false);
});

test("podeMarcarServo compara o setor exatamente (sem ignorar maiúscula)", () => {
  assert.equal(podeMarcarServo({ setor: "TROPA", missaoIds: [98] }, { setor: "tropa", missaoId: 98 }), false);
});

test("dadosDoStatus: ATIVO limpa os dois motivos", () => {
  assert.deepEqual(dadosDoStatus("ATIVO", "qualquer"), { status: "ATIVO", confirmado: true, motivoRecusou: null, motivoDesistiu: null });
});

test("dadosDoStatus: RECUSOU e DESISTIU gravam só o motivo do próprio status", () => {
  assert.deepEqual(dadosDoStatus("RECUSOU", "viagem"), { status: "RECUSOU", confirmado: false, motivoRecusou: "viagem", motivoDesistiu: null });
  assert.deepEqual(dadosDoStatus("DESISTIU", "doença"), { status: "DESISTIU", confirmado: false, motivoRecusou: null, motivoDesistiu: "doença" });
});

test("dadosDoStatus: motivo com espaços, vazio ou ausente vira null", () => {
  assert.equal(dadosDoStatus("RECUSOU", "   ").motivoRecusou, null);
  assert.equal(dadosDoStatus("RECUSOU", "").motivoRecusou, null);
  assert.equal(dadosDoStatus("RECUSOU").motivoRecusou, null);
  assert.equal(dadosDoStatus("RECUSOU", null).motivoRecusou, null);
  assert.equal(dadosDoStatus("DESISTIU", "  trabalho  ").motivoDesistiu, "trabalho");
});

test("dadosDoStatus: motivo gigante é cortado em MOTIVO_MAX", () => {
  const r = dadosDoStatus("DESISTIU", "a".repeat(MOTIVO_MAX + 200));
  assert.equal(r.motivoDesistiu?.length, MOTIVO_MAX);
});

test("normalizarRole: SUPER, COORDENADOR e SERVO_SECRETARIA são preservados, o resto vira ADMIN", () => {
  assert.equal(normalizarRole("SERVO_SECRETARIA"), "SERVO_SECRETARIA");
  assert.equal(normalizarRole("SUPER"), "SUPER");
  assert.equal(normalizarRole("COORDENADOR"), "COORDENADOR");
  assert.equal(normalizarRole("ADMIN"), "ADMIN");
  for (const v of ["super", "", null, undefined, "ROOT", 3]) assert.equal(normalizarRole(v), "ADMIN");
});

test("camisetaValida: tamanho da lista ou null (limpar); o resto é recusado", () => {
  const t = ["P", "M", "G"];
  assert.equal(camisetaValida("M", t), true);
  assert.equal(camisetaValida(null, t), true);
  for (const v of ["", "XL", "m", undefined, 1, {}]) assert.equal(camisetaValida(v, t), false);
});

test("podeUsarEvangelizacao: SUPER e ADMIN sempre; coordenador só do setor EVANGELIZAÇÃO", () => {
  assert.equal(podeUsarEvangelizacao({ role: "SUPER", setor: null }), true);
  assert.equal(podeUsarEvangelizacao({ role: "ADMIN", setor: null }), true);
  assert.equal(podeUsarEvangelizacao({ role: "COORDENADOR", setor: "EVANGELIZAÇÃO" }), true);
  assert.equal(podeUsarEvangelizacao({ role: "COORDENADOR", setor: "COZINHA" }), false);
  assert.equal(podeUsarEvangelizacao({ role: "COORDENADOR", setor: null }), false);
  assert.equal(podeUsarEvangelizacao({ role: "COORDENADOR", setor: "Evangelização" }), false);
});

test("rotaPermitidaServoSecretaria: só servos, formação, tribos e fichas (e subrotas)", () => {
  for (const ok of ["/servos", "/servos/12", "/formacao", "/tribos/3", "/fichas", "/fichas/novo"]) {
    assert.equal(rotaPermitidaServoSecretaria(ok), true, ok);
  }
  for (const no of ["/", "/financeiro", "/usuarios", "/servosx", "/fichas-x", "/gerador-fichas", "/pessoas/1", "", null, undefined]) {
    assert.equal(rotaPermitidaServoSecretaria(no), false, String(no));
  }
});
