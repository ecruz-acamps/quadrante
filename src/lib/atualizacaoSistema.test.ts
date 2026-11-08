import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoDoLog } from "./atualizacaoSistema";

test("estadoDoLog: rodando tem prioridade", () => assert.equal(estadoDoLog("x\n== CONCLUIDO ==", true), "rodando"));
test("estadoDoLog: terminadores", () => {
  assert.equal(estadoDoLog("a\n== CONCLUIDO ==\n", false), "concluido");
  assert.equal(estadoDoLog("a\nERRO: x\n== FALHOU ==\n", false), "falhou");
});
test("estadoDoLog: vazio é parado; sem terminador e sem processo é falha", () => {
  assert.equal(estadoDoLog("", false), "parado");
  assert.equal(estadoDoLog("-- Compilando", false), "falhou");
});
