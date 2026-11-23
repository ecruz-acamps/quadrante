import { test } from "node:test";
import assert from "node:assert/strict";
import { lerClaimsIdToken, validarClaims, type ClaimsIdToken } from "./microsoftAuth";

const TENANT = "11111111-2222-3333-4444-555555555555";
const esperado = { tenantId: TENANT, clientId: "app-1", nonce: "n1", agoraSeg: 1_000 };
const bom: ClaimsIdToken = {
  aud: "app-1",
  tid: TENANT,
  iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
  exp: 2_000,
  nonce: "n1",
  preferred_username: "Maria@Acampamento.org",
  name: "Maria",
};

test("validarClaims: aceita conta do tenant e usa o e-mail em minúsculas", () => {
  assert.deepEqual(validarClaims(bom, esperado), { ok: true, email: "maria@acampamento.org", nome: "Maria" });
  assert.deepEqual(validarClaims({ ...bom, email: "m@x.org" }, esperado), { ok: true, email: "m@x.org", nome: "Maria" });
});

test("validarClaims: recusa outro tenant, outro app, nonce errado, vencido e sem e-mail", () => {
  const outro = "99999999-2222-3333-4444-555555555555";
  assert.deepEqual(validarClaims({ ...bom, tid: outro, iss: `https://login.microsoftonline.com/${outro}/v2.0` }, esperado), { ok: false, motivo: "tenant" });
  assert.deepEqual(validarClaims({ ...bom, aud: "outro" }, esperado), { ok: false, motivo: "aud" });
  assert.deepEqual(validarClaims({ ...bom, nonce: "x" }, esperado), { ok: false, motivo: "nonce" });
  assert.deepEqual(validarClaims({ ...bom, exp: 999 }, esperado), { ok: false, motivo: "exp" });
  assert.deepEqual(validarClaims({ ...bom, preferred_username: "sem-arroba" }, esperado), { ok: false, motivo: "email" });
});

test("lerClaimsIdToken: lê o conteúdo do JWT", () => {
  const corpo = Buffer.from(JSON.stringify(bom)).toString("base64url");
  assert.equal(lerClaimsIdToken(`x.${corpo}.y`).tid, TENANT);
  assert.throws(() => lerClaimsIdToken("malformado"));
});
