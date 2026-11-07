import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gerarCodigoRestauracao,
  codigoConfere,
  tentativaBloqueada,
  limparTentativas,
  iniciarRestauracao,
} from "./codigoRestauracao";

test("gera XXXX-XXXX-XXXX hexadecimal maiúsculo", () => {
  assert.match(gerarCodigoRestauracao(), /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
});

test("dois códigos gerados são diferentes", () => {
  assert.notEqual(gerarCodigoRestauracao(), gerarCodigoRestauracao());
});

test("confere ignora caixa, hífens e espaços", () => {
  assert.equal(codigoConfere("ABCD-1234-EF56", " abcd1234ef56 "), true);
});

test("recusa código errado", () => {
  assert.equal(codigoConfere("ABCD-1234-EF56", "ABCD-1234-EF57"), false);
});

test("recusa quando não há código esperado, mesmo informado vazio", () => {
  assert.equal(codigoConfere(undefined, ""), false);
  assert.equal(codigoConfere("", ""), false);
});

test("bloqueia na 6ª tentativa e libera após limparTentativas", () => {
  limparTentativas();
  for (let i = 0; i < 5; i++) assert.equal(tentativaBloqueada(), false);
  assert.equal(tentativaBloqueada(), true);
  limparTentativas();
  assert.equal(tentativaBloqueada(), false);
  limparTentativas();
});

test("iniciarRestauracao: segunda chamada recebe null até liberar", () => {
  const liberar = iniciarRestauracao();
  assert.ok(liberar);
  assert.equal(iniciarRestauracao(), null);
  liberar!();
  const outra = iniciarRestauracao();
  assert.ok(outra);
  outra!();
});
