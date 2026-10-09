import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroMissao, nomeSetor, mensagensChamado } from "./chamado";

test("numeroMissao lê o número do começo do nome", () => {
  assert.equal(numeroMissao("24º Acampamento Sênior"), "24");
  assert.equal(numeroMissao("23° Acampamento Sênior"), "23");
  assert.equal(numeroMissao("Acampamento"), null);
});

test("nomeSetor deixa só a inicial de cada palavra maiúscula", () => {
  assert.equal(nomeSetor("EVANGELIZAÇÃO"), "Evangelização");
  assert.equal(nomeSetor("TROPA DE ELITE"), "Tropa De Elite");
});

test("mensagensChamado monta as três mensagens", () => {
  const m = mensagensChamado({ nome: "Maria Souza", missaoNome: "24º Acampamento Sênior", setor: "EVANGELIZAÇÃO" });
  assert.equal(m[0], "Olá,\nTudo bem?\nFalo com Maria Souza?");
  assert.equal(m[1], "Jesus te chama para servir no 24º Acampamento Sênior, você aceita este chamado?");
  assert.equal(m[2], "Louvado seja Deus, pelo seu SIM!\nSeu setor é Evangelização.");
});
