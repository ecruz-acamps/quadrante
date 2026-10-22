import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroMissao, nomeSetor, mensagensChamado, linkWhatsapp } from "./chamado";

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

test("linkWhatsapp monta o link com DDI 55 e ignora número inválido", () => {
  assert.equal(linkWhatsapp("(21) 99999-8888"), "https://wa.me/5521999998888");
  assert.equal(linkWhatsapp("+55 21 99999-8888"), "https://wa.me/5521999998888");
  assert.equal(linkWhatsapp("021 3333-4444"), "https://wa.me/552133334444");
  assert.equal(linkWhatsapp("9999-8888"), null);
  assert.equal(linkWhatsapp(null), null);
  assert.equal(linkWhatsapp("21999998888", "Olá,\nTudo bem?"), "https://wa.me/5521999998888?text=Ol%C3%A1%2C%0ATudo%20bem%3F");
});
