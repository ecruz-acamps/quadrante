import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { excedeuLimite, limparLimite } from "./rateLimit";

test("barra a partir da tentativa max+1 e libera com limparLimite", () => {
  const k = "t:basico";
  for (let i = 0; i < 3; i++) assert.equal(excedeuLimite(k, 3, 60_000), false);
  assert.equal(excedeuLimite(k, 3, 60_000), true);
  limparLimite(k);
  assert.equal(excedeuLimite(k, 3, 60_000), false);
});

test("chaves diferentes (IP + nome) não se bloqueiam entre si", () => {
  for (let i = 0; i < 2; i++) excedeuLimite("t:1.1.1.1:ana", 2, 60_000);
  assert.equal(excedeuLimite("t:1.1.1.1:ana", 2, 60_000), true);
  assert.equal(excedeuLimite("t:1.1.1.1:bia", 2, 60_000), false);
});

test("registra o bloqueio no log uma vez por janela", () => {
  const aviso = mock.method(console, "warn", () => {});
  const k = "t:log";
  excedeuLimite(k, 1, 60_000);
  excedeuLimite(k, 1, 60_000);
  excedeuLimite(k, 1, 60_000);
  assert.equal(aviso.mock.callCount(), 1);
  assert.match(String(aviso.mock.calls[0].arguments[0]), /\[rate-limit\] bloqueado chave=t:log/);
  aviso.mock.restore();
});
