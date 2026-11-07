import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ErroCloudflare,
  hostnameValido,
  verificarToken,
  localizarZona,
  lerRegistroDns,
  criarTunel,
  definirRota,
  gravarRegistroDns,
} from "./cloudflare";

const TOKEN = "token-secreto-da-api-0123456789";

type Chamada = { metodo: string; caminho: string; auth: string | null; corpo: unknown };

// fetch falso: responde por "METODO /caminho?query" e registra tudo; resposta = [status, corpo]
function fakeFetch(respostas: Record<string, [number, unknown]>) {
  const chamadas: Chamada[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const caminho = String(url).replace("https://api.cloudflare.com/client/v4", "");
    const metodo = init?.method ?? "GET";
    chamadas.push({
      metodo,
      caminho,
      auth: new Headers(init?.headers).get("authorization"),
      corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const [status, corpo] = respostas[`${metodo} ${caminho}`] ?? [404, { success: false, errors: [{ message: "rota não simulada" }] }];
    return new Response(JSON.stringify(corpo), { status });
  }) as typeof fetch;
  return { f, chamadas };
}

const ok = (result: unknown): [number, unknown] => [200, { success: true, errors: [], result }];

test("hostnameValido aceita quadrante.movimentocampista.com.br", () => {
  assert.equal(hostnameValido("quadrante.movimentocampista.com.br"), true);
});

test("hostnameValido recusa maiúsculas, curinga, rótulo único, espaço, quebra de linha, URL e ponto duplo", () => {
  for (const ruim of ["Quadrante.exemplo.com", "*.exemplo.com", "exemplo", "a b.com", "a.com\n", "https://a.com", "a..com", "-a.com", "a;rm.com"]) {
    assert.equal(hostnameValido(ruim), false, ruim);
  }
});

test("verificarToken: token de usuário chama /user/tokens/verify; token de conta (cfat_) não", async () => {
  const a = fakeFetch({ "GET /user/tokens/verify": ok({ status: "active" }) });
  await verificarToken(a.f, TOKEN);
  assert.equal(a.chamadas[0].caminho, "/user/tokens/verify");
  const b = fakeFetch({});
  await verificarToken(b.f, "cfat_abcdefghijklmnopqrstuvwxyz0123456789");
  assert.equal(b.chamadas.length, 0);
});

test("verificarToken: 401 vira ErroCloudflare 'token' sem o token na mensagem", async () => {
  const { f } = fakeFetch({ "GET /user/tokens/verify": [401, { success: false, errors: [{ message: "Invalid" }] }] });
  await assert.rejects(verificarToken(f, TOKEN), (e: unknown) => {
    assert.ok(e instanceof ErroCloudflare);
    assert.match(e.message, /token/i);
    assert.equal(e.message.includes(TOKEN), false);
    return true;
  });
});

test("localizarZona tenta a.b.exemplo.com, b.exemplo.com, exemplo.com nessa ordem e devolve conta e zona", async () => {
  const { f, chamadas } = fakeFetch({
    "GET /zones?name=a.b.exemplo.com": ok([]),
    "GET /zones?name=b.exemplo.com": ok([]),
    "GET /zones?name=exemplo.com": ok([{ id: "zona1", account: { id: "conta1" } }]),
  });
  assert.deepEqual(await localizarZona(f, TOKEN, "a.b.exemplo.com"), { contaId: "conta1", zonaId: "zona1" });
  assert.deepEqual(
    chamadas.map((c) => c.caminho),
    ["/zones?name=a.b.exemplo.com", "/zones?name=b.exemplo.com", "/zones?name=exemplo.com"],
  );
});

test("localizarZona sem resultado → ErroCloudflare 'Domínio não encontrado'", async () => {
  const { f } = fakeFetch({ "GET /zones?name=app.x.com": ok([]), "GET /zones?name=x.com": ok([]) });
  await assert.rejects(localizarZona(f, TOKEN, "app.x.com"), /Domínio não encontrado/);
});

test("lerRegistroDns devolve o registro existente ou null", async () => {
  const { f } = fakeFetch({
    "GET /zones/z1/dns_records?name=app.x.com": ok([{ id: "r1", type: "CNAME", content: "abc.cfargotunnel.com" }]),
    "GET /zones/z1/dns_records?name=novo.x.com": ok([]),
  });
  assert.deepEqual(await lerRegistroDns(f, TOKEN, "z1", "app.x.com"), { id: "r1", tipo: "CNAME", conteudo: "abc.cfargotunnel.com" });
  assert.equal(await lerRegistroDns(f, TOKEN, "z1", "novo.x.com"), null);
});

test("criarTunel envia config_src cloudflare com Authorization Bearer e devolve id e tokenTunel", async () => {
  const { f, chamadas } = fakeFetch({ "POST /accounts/c1/cfd_tunnel": ok({ id: "t1", token: "eyJ-token-do-tunel" }) });
  assert.deepEqual(await criarTunel(f, TOKEN, "c1", "quadrante-20261107"), { id: "t1", tokenTunel: "eyJ-token-do-tunel" });
  assert.deepEqual(chamadas[0].corpo, { name: "quadrante-20261107", config_src: "cloudflare" });
  assert.equal(chamadas[0].auth, `Bearer ${TOKEN}`);
});

test("criarTunel busca o token em /token quando a criação não o devolve", async () => {
  const { f } = fakeFetch({
    "POST /accounts/c1/cfd_tunnel": ok({ id: "t1" }),
    "GET /accounts/c1/cfd_tunnel/t1/token": ok("eyJ-token-buscado"),
  });
  assert.deepEqual(await criarTunel(f, TOKEN, "c1", "n"), { id: "t1", tokenTunel: "eyJ-token-buscado" });
});

test("definirRota envia ingress hostname→http://localhost:3008 e http_status:404", async () => {
  const { f, chamadas } = fakeFetch({ "PUT /accounts/c1/cfd_tunnel/t1/configurations": ok({}) });
  await definirRota(f, TOKEN, "c1", "t1", "app.x.com", "http://localhost:3008");
  assert.deepEqual(chamadas[0].corpo, {
    config: { ingress: [{ hostname: "app.x.com", service: "http://localhost:3008" }, { service: "http_status:404" }] },
  });
});

test("gravarRegistroDns: POST CNAME com proxy se novo; PUT no registro existente", async () => {
  const novo = fakeFetch({ "POST /zones/z1/dns_records": ok({}) });
  await gravarRegistroDns(novo.f, TOKEN, "z1", "app.x.com", "t1");
  assert.deepEqual(novo.chamadas[0].corpo, { type: "CNAME", name: "app.x.com", content: "t1.cfargotunnel.com", proxied: true });
  const antigo = fakeFetch({ "PUT /zones/z1/dns_records/r9": ok({}) });
  await gravarRegistroDns(antigo.f, TOKEN, "z1", "app.x.com", "t1", "r9");
  assert.equal(antigo.chamadas[0].metodo, "PUT");
});

test("resposta 403 vira ErroCloudflare que cita a permissão e não vaza o token", async () => {
  const { f } = fakeFetch({ "POST /accounts/c1/cfd_tunnel": [403, { success: false, errors: [{ code: 10000, message: "Authentication error" }] }] });
  await assert.rejects(criarTunel(f, TOKEN, "c1", "n"), (e: unknown) => {
    assert.ok(e instanceof ErroCloudflare);
    assert.equal(e.status, 403);
    assert.match(e.message, /permiss/i);
    assert.match(e.message, /Cloudflare Tunnel/);
    assert.equal(e.message.includes(TOKEN), false);
    return true;
  });
});

test("falha de rede vira ErroCloudflare sem vazar o token", async () => {
  const f = (async () => {
    throw new Error(`connect ECONNREFUSED com ${TOKEN}`);
  }) as unknown as typeof fetch;
  await assert.rejects(verificarToken(f, TOKEN), (e: unknown) => {
    assert.ok(e instanceof ErroCloudflare);
    assert.equal(e.message.includes(TOKEN), false);
    return true;
  });
});
