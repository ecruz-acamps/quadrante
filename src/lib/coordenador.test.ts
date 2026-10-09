import { test } from "node:test";
import assert from "node:assert/strict";
import { statusValido, podeMarcarServo, dadosDoStatus, normalizarRole, MOTIVO_MAX } from "./coordenador";

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
  assert.deepEqual(dadosDoStatus("ATIVO", "qualquer"), { status: "ATIVO", motivoRecusou: null, motivoDesistiu: null });
});

test("dadosDoStatus: RECUSOU e DESISTIU gravam só o motivo do próprio status", () => {
  assert.deepEqual(dadosDoStatus("RECUSOU", "viagem"), { status: "RECUSOU", motivoRecusou: "viagem", motivoDesistiu: null });
  assert.deepEqual(dadosDoStatus("DESISTIU", "doença"), { status: "DESISTIU", motivoRecusou: null, motivoDesistiu: "doença" });
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

test("normalizarRole: só SUPER e COORDENADOR são preservados, o resto vira ADMIN", () => {
  assert.equal(normalizarRole("SUPER"), "SUPER");
  assert.equal(normalizarRole("COORDENADOR"), "COORDENADOR");
  assert.equal(normalizarRole("ADMIN"), "ADMIN");
  for (const v of ["super", "", null, undefined, "ROOT", 3]) assert.equal(normalizarRole(v), "ADMIN");
});
