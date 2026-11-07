import { test } from "node:test";
import assert from "node:assert/strict";
import { criarEAtivarTunel } from "./tunelCloudflare";
import { ErroCloudflare } from "./cloudflare";

const TOKEN_API = "token-da-api-super-secreto-0123456789";
const TOKEN_TUNEL = "eyJ-token-do-tunel-que-tambem-e-segredo";

const ok = (result: unknown): [number, unknown] => [200, { success: true, errors: [], result }];

type Cenario = { dns?: unknown[]; tunel?: [number, unknown]; ligarFalha?: boolean; hostnameZona?: boolean };

// monta fetch falso + ligar falso que escrevem num mesmo registro de eventos (só escritas e o "ligar")
function montar(c: Cenario = {}) {
  const eventos: string[] = [];
  let corpoDoTunel: { name?: string } | undefined;
  const respostas: Record<string, [number, unknown]> = {
    "GET /user/tokens/verify": ok({ status: "active" }),
    "GET /zones?name=app.x.com": ok([]),
    "GET /zones?name=x.com": ok([{ id: "z1", account: { id: "c1" } }]),
    "GET /zones/z1/dns_records?name=app.x.com": ok(c.dns ?? []),
    "POST /accounts/c1/cfd_tunnel": c.tunel ?? ok({ id: "t1", token: TOKEN_TUNEL }),
    "PUT /accounts/c1/cfd_tunnel/t1/configurations": ok({}),
    "POST /zones/z1/dns_records": ok({}),
    "PUT /zones/z1/dns_records/r1": ok({}),
  };
  let chamadasFetch = 0;
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadasFetch++;
    const caminho = String(url).replace("https://api.cloudflare.com/client/v4", "");
    const metodo = init?.method ?? "GET";
    if (metodo !== "GET") eventos.push(`${metodo} ${caminho}`);
    if (metodo === "POST" && caminho === "/accounts/c1/cfd_tunnel") corpoDoTunel = JSON.parse(String(init?.body));
    const [status, corpo] = respostas[`${metodo} ${caminho}`] ?? [404, { success: false, errors: [{ message: "não simulado" }] }];
    return new Response(JSON.stringify(corpo), { status });
  }) as typeof fetch;
  const ligar = async (t: string) => {
    assert.equal(t, TOKEN_TUNEL);
    eventos.push("ligar");
    if (c.ligarFalha) throw new Error("serviço não subiu");
  };
  return { f, ligar, eventos, chamadasFetch: () => chamadasFetch, corpoDoTunel: () => corpoDoTunel };
}

const entrada = (confirmar = false, hostname = "app.x.com") => ({ tokenApi: TOKEN_API, hostname, confirmarTrocaDns: confirmar });
const CNAME_ANTIGO = [{ id: "r1", type: "CNAME", content: "antigo.cfargotunnel.com" }];

test("DNS existente sem confirmação → CONFIRMAR_TROCA, sem criar túnel nem ligar nada", async () => {
  const m = montar({ dns: CNAME_ANTIGO });
  const r = await criarEAtivarTunel(entrada(false), { fetch: m.f, ligar: m.ligar });
  assert.deepEqual(r, { estado: "CONFIRMAR_TROCA", atual: { tipo: "CNAME", conteudo: "antigo.cfargotunnel.com" } });
  assert.deepEqual(m.eventos, []);
});

test("registro A existente também pede confirmação", async () => {
  const m = montar({ dns: [{ id: "r1", type: "A", content: "203.0.113.9" }] });
  const r = await criarEAtivarTunel(entrada(false), { fetch: m.f, ligar: m.ligar });
  assert.equal(r.estado, "CONFIRMAR_TROCA");
  assert.deepEqual(m.eventos, []);
});

test("com confirmação: criarTunel → definirRota → ligar → gravarRegistroDns (DNS por último)", async () => {
  const m = montar({ dns: CNAME_ANTIGO });
  const r = await criarEAtivarTunel(entrada(true), { fetch: m.f, ligar: m.ligar });
  assert.deepEqual(r, { estado: "OK", hostname: "app.x.com", tunelId: "t1" });
  assert.deepEqual(m.eventos, [
    "POST /accounts/c1/cfd_tunnel",
    "PUT /accounts/c1/cfd_tunnel/t1/configurations",
    "ligar",
    "PUT /zones/z1/dns_records/r1",
  ]);
  assert.match(m.corpoDoTunel()?.name ?? "", /^quadrante-\d{8}-\d{6}$/);
});

test("sem DNS existente: OK sem pedir confirmação, criando o registro", async () => {
  const m = montar({ dns: [] });
  const r = await criarEAtivarTunel(entrada(false), { fetch: m.f, ligar: m.ligar });
  assert.equal(r.estado, "OK");
  assert.equal(m.eventos.at(-1), "POST /zones/z1/dns_records");
});

test("ligar que falha → rejeita e o DNS não é gravado", async () => {
  const m = montar({ dns: CNAME_ANTIGO, ligarFalha: true });
  await assert.rejects(criarEAtivarTunel(entrada(true), { fetch: m.f, ligar: m.ligar }), /serviço não subiu/);
  assert.equal(m.eventos.some((e) => e.includes("dns_records")), false);
});

test("hostname inválido → rejeita antes de qualquer chamada à Cloudflare", async () => {
  const m = montar();
  await assert.rejects(criarEAtivarTunel(entrada(true, "Evil Host;rm"), { fetch: m.f, ligar: m.ligar }), /endereço/i);
  assert.equal(m.chamadasFetch(), 0);
});

test("token sem permissão (403 ao criar o túnel) → mensagem com a permissão, sem ligar nem gravar DNS", async () => {
  const m = montar({ dns: [], tunel: [403, { success: false, errors: [{ message: "Authentication error" }] }] });
  await assert.rejects(criarEAtivarTunel(entrada(false), { fetch: m.f, ligar: m.ligar }), (e: unknown) => {
    assert.ok(e instanceof ErroCloudflare);
    assert.match(e.message, /permiss/i);
    assert.equal(e.message.includes(TOKEN_API), false);
    return true;
  });
  assert.deepEqual(m.eventos, ["POST /accounts/c1/cfd_tunnel"]);
});

test("o resultado nunca contém o token da API nem o token do túnel", async () => {
  const m = montar({ dns: CNAME_ANTIGO });
  const texto = JSON.stringify([
    await criarEAtivarTunel(entrada(false), { fetch: m.f, ligar: m.ligar }),
    await criarEAtivarTunel(entrada(true), { fetch: m.f, ligar: m.ligar }),
  ]);
  assert.equal(texto.includes(TOKEN_API), false);
  assert.equal(texto.includes(TOKEN_TUNEL), false);
});
