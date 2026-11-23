import { test } from "node:test";
import assert from "node:assert/strict";
import { explicarErro, testarCredenciais, urlsSugeridas, validarEntra } from "./entraConfig";

const T = "11111111-2222-3333-4444-555555555555";
const C = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const base = {
  tenantId: ` ${T} `,
  clientId: C.toUpperCase(),
  segredo: "abc8Q~xyz.123_-AbC",
  urlLogin: "https://q.exemplo.org/api/auth/microsoft/callback",
  urlOneDrive: "https://q.exemplo.org/api/onedrive/callback",
};

test("urlsSugeridas: monta os dois retornos a partir do endereço público", () => {
  assert.deepEqual(urlsSugeridas("Q.Exemplo.org"), {
    login: "https://q.exemplo.org/api/auth/microsoft/callback",
    onedrive: "https://q.exemplo.org/api/onedrive/callback",
  });
  assert.equal(urlsSugeridas(undefined), null);
});

test("validarEntra: aceita, normaliza IDs e mantém o segredo atual quando o campo vem em branco", () => {
  const r = validarEntra(base, undefined);
  assert.ok("valores" in r);
  assert.equal(r.valores.ENTRA_TENANT_ID, T);
  assert.equal(r.valores.ENTRA_CLIENT_ID, C);
  const mantido = validarEntra({ ...base, segredo: "" }, "segredo-antigo-123");
  assert.ok("valores" in mantido && mantido.valores.ENTRA_CLIENT_SECRET === "segredo-antigo-123");
});

test("validarEntra: recusa IDs errados, ID do segredo no lugar do valor, segredo com aspas e retorno em http", () => {
  const erro = (e: Partial<typeof base>, atual?: string) => {
    const r = validarEntra({ ...base, ...e }, atual);
    return "erro" in r ? r.erro : "";
  };
  assert.match(erro({ tenantId: "contoso.onmicrosoft.com" }), /diretório/);
  assert.match(erro({ clientId: "123" }), /aplicativo/);
  assert.match(erro({ segredo: "" }), /Informe o segredo/);
  assert.match(erro({ segredo: T }), /ID do segredo/);
  assert.match(erro({ segredo: 'abc"def$ghi' }), /formato/);
  assert.match(erro({ urlLogin: "http://q.exemplo.org/api/auth/microsoft/callback" }), /login inválida/);
  assert.match(erro({ urlOneDrive: "https://q.exemplo.org/api/onedrive/callback/" }), /OneDrive inválida/);
});

test("testarCredenciais: token emitido = ok; erros da Microsoft viram mensagem clara", async () => {
  let corpo = "";
  const ok = (async (_u: unknown, init?: RequestInit) => {
    corpo = String(init?.body);
    return new Response(JSON.stringify({ access_token: "x" }), { status: 200 });
  }) as typeof fetch;
  const v = { ENTRA_TENANT_ID: T, ENTRA_CLIENT_ID: C, ENTRA_CLIENT_SECRET: "s" };
  assert.deepEqual(await testarCredenciais(v, ok), { ok: true });
  assert.match(corpo, /grant_type=client_credentials/);

  const segredoErrado = (async () =>
    new Response(JSON.stringify({ error_description: "AADSTS7000215: Invalid client secret provided." }), { status: 401 })) as typeof fetch;
  const r = await testarCredenciais(v, segredoErrado);
  assert.ok(!r.ok && /Segredo do cliente inválido.*AADSTS7000215.*Nada foi gravado/.test(r.erro));

  const semRede = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;
  const r2 = await testarCredenciais(v, semRede);
  assert.ok(!r2.ok && /rede/.test(r2.erro));
});

test("explicarErro: código desconhecido mostra o código", () => {
  assert.match(explicarErro("AADSTS12345: x", 400), /recusou as credenciais.*AADSTS12345/);
  assert.match(explicarErro("", 500), /HTTP 500/);
});
