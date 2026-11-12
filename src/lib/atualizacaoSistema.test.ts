import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoDoLog, lerAlteracoes, precisaVerificar, INTERVALO_VERIFICACAO_MS } from "./atualizacaoSistema";

test("estadoDoLog: rodando tem prioridade", () => assert.equal(estadoDoLog("x\n== CONCLUIDO ==", true), "rodando"));
test("estadoDoLog: terminadores", () => {
  assert.equal(estadoDoLog("a\n== CONCLUIDO ==\n", false), "concluido");
  assert.equal(estadoDoLog("a\nERRO: x\n== FALHOU ==\n", false), "falhou");
});
test("estadoDoLog: vazio é parado; sem terminador e sem processo é falha", () => {
  assert.equal(estadoDoLog("", false), "parado");
  assert.equal(estadoDoLog("-- Compilando", false), "falhou");
});

test("lerAlteracoes: hash e título separados por tab; linhas vazias ignoradas", () => {
  assert.deepEqual(lerAlteracoes("abc1234\tTribos: líderes do setor\n\ndef5678\tCerco: limite\tcom tab\n"), [
    { hash: "abc1234", titulo: "Tribos: líderes do setor" },
    { hash: "def5678", titulo: "Cerco: limite\tcom tab" },
  ]);
  assert.deepEqual(lerAlteracoes(""), []);
});

test("precisaVerificar: nunca verificado ou passou do intervalo", () => {
  const agora = 10 * INTERVALO_VERIFICACAO_MS;
  assert.equal(precisaVerificar(null, agora), true);
  assert.equal(precisaVerificar(agora - 1000, agora), false);
  assert.equal(precisaVerificar(agora - INTERVALO_VERIFICACAO_MS, agora), true);
});
