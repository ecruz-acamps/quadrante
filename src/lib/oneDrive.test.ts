import { test } from "node:test";
import assert from "node:assert/strict";
import { criarClienteGraph, reiniciarOneDrive } from "./oneDrive";

process.env.ENTRA_TENANT_ID = "t1";
process.env.ENTRA_CLIENT_ID = "c1";
process.env.ENTRA_CLIENT_SECRET = "s1";

type Chamada = { metodo: string; url: string; corpo?: string };

// Microsoft simulada: responde conforme a lista de regras, na ordem
function microsoftFalsa(regras: Array<[RegExp, (c: Chamada) => Response]>) {
  const chamadas: Chamada[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const c: Chamada = { metodo: init?.method ?? "GET", url: String(url), corpo: typeof init?.body === "string" || init?.body instanceof URLSearchParams ? String(init.body) : undefined };
    chamadas.push(c);
    const i = regras.findIndex(([re]) => re.test(`${c.metodo} ${c.url}`));
    if (i === -1) return new Response(JSON.stringify({ error: { code: "naoPrevisto" } }), { status: 500 });
    const [, resp] = regras[i];
    regras.splice(i, 1); // cada regra vale uma vez
    return resp(c);
  }) as typeof fetch;
  return { f, chamadas };
}

const json = (obj: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...headers } });

function dbFalso() {
  const linha = { id: 1, conta: "a@x", refreshToken: "rt-velho", raizDriveId: null as string | null, raizId: null as string | null };
  return {
    linha,
    integracaoOneDrive: {
      findUnique: async () => linha,
      update: async ({ data }: { data: Partial<typeof linha> }) => Object.assign(linha, data),
    },
  };
}

test("token renovado e refresh token novo guardado; pasta criada; envio e nome com acento", async () => {
  reiniciarOneDrive();
  const db = dbFalso();
  const token = () => json({ access_token: "at", refresh_token: "rt-novo", expires_in: 3600 });
  const { f, chamadas } = microsoftFalsa([
    [/POST https:\/\/login\.microsoftonline\.com\/t1\/oauth2\/v2\.0\/token/, token],
    [/GET .*\/me\/drive\/root$/, () => json({ id: "R", parentReference: { driveId: "D" } })],
    [/GET .*\/drives\/D\/items\/R:\/Quadrante$/, () => json({ error: { code: "itemNotFound" } }, 404)],
    [/POST .*\/drives\/D\/items\/R\/children$/, () => json({ id: "Q", folder: {}, parentReference: { driveId: "D" } }, 201)],
    [/GET .*\/drives\/D\/items\/Q:\/23%C2%BA%20S%C3%AAnior$/, () => json({ id: "M", folder: {}, parentReference: { driveId: "D" } })],
    [/PUT .*\/drives\/D\/items\/M:\/Scan%201\.pdf:\/content\?@microsoft\.graph\.conflictBehavior=rename$/, () =>
      json({ id: "F", name: "Scan 1.pdf", size: 3, webUrl: "https://w/F", parentReference: { driveId: "D" } }, 201)],
  ]);
  const od = criarClienteGraph(db as never, f);
  const pasta = await od.garantirPasta(["23º Sênior"]);
  assert.deepEqual(pasta, { driveId: "D", id: "M" });
  const item = await od.enviar(pasta, "Scan 1.pdf", Buffer.from("abc"), "rename");
  assert.equal(item.id, "F");
  assert.equal(db.linha.refreshToken, "rt-novo");
  assert.match(chamadas[0].corpo ?? "", /grant_type=refresh_token/);
  assert.match(chamadas[0].corpo ?? "", /refresh_token=rt-velho/);
  // a pasta já encontrada não é procurada de novo
  await od.garantirPasta(["23º Sênior"]);
  assert.equal(chamadas.length, 6); // token, raiz, Quadrante (404), cria Quadrante, missão, envio
});

test("renomear com nome repetido tenta (2); limite de uso (429) espera e repete; apagar o que já não existe não é erro", async () => {
  reiniciarOneDrive();
  const db = dbFalso();
  const { f, chamadas } = microsoftFalsa([
    [/POST .*\/token/, () => json({ access_token: "at", expires_in: 3600 })],
    [/PATCH .*\/items\/F$/, () => json({ error: { code: "nameAlreadyExists" } }, 409)],
    [/PATCH .*\/items\/F$/, () => json({ error: { code: "throttled" } }, 429, { "Retry-After": "0" })],
    [/PATCH .*\/items\/F$/, () => json({ id: "F", name: "012 - Ana (2).pdf", parentReference: { driveId: "D" } })],
    [/DELETE .*\/items\/X$/, () => new Response(null, { status: 404 })],
  ]);
  const od = criarClienteGraph(db as never, f);
  const r = await od.renomear({ driveId: "D", id: "F" }, "012 - Ana.pdf");
  assert.equal(r.name, "012 - Ana (2).pdf");
  const nomes = chamadas.filter((c) => c.metodo === "PATCH").map((c) => JSON.parse(c.corpo!).name);
  assert.deepEqual(nomes, ["012 - Ana.pdf", "012 - Ana (2).pdf", "012 - Ana (2).pdf"]);
  await od.apagar({ driveId: "D", id: "X" });
});

test("pasta raiz escolhida por link: usa a pasta gravada, sem passar pelo OneDrive da conta", async () => {
  reiniciarOneDrive();
  const db = dbFalso();
  db.linha.raizDriveId = "SP";
  db.linha.raizId = "LIB";
  const { f, chamadas } = microsoftFalsa([
    [/POST .*\/token/, () => json({ access_token: "at", expires_in: 3600 })],
    [/GET .*\/drives\/SP\/items\/LIB:\/Backups$/, () => json({ id: "B", folder: {}, parentReference: { driveId: "SP" } })],
  ]);
  const od = criarClienteGraph(db as never, f);
  assert.deepEqual(await od.garantirPasta(["Backups"]), { driveId: "SP", id: "B" });
  assert.ok(!chamadas.some((c) => c.url.includes("/me/drive")));
});

test("sem conexão: erro claro pedindo para conectar", async () => {
  reiniciarOneDrive();
  const db = { integracaoOneDrive: { findUnique: async () => null, update: async () => null } };
  const od = criarClienteGraph(db as never, (async () => json({})) as typeof fetch);
  await assert.rejects(od.garantirPasta(["x"]), /Conectar OneDrive/);
});

test("urlDaPasta: devolve o endereço web da pasta", async () => {
  reiniciarOneDrive();
  const db = dbFalso();
  const { f, chamadas } = microsoftFalsa([
    [/POST .*\/token/, () => json({ access_token: "at", expires_in: 3600 })],
    [/GET .*\/drives\/D\/items\/M\?\$select=webUrl$/, () => json({ webUrl: "https://contoso-my.sharepoint.com/personal/x/Documents/Quadrante/23" })],
  ]);
  const od = criarClienteGraph(db as never, f);
  assert.equal(await od.urlDaPasta({ driveId: "D", id: "M" }), "https://contoso-my.sharepoint.com/personal/x/Documents/Quadrante/23");
  assert.equal(chamadas.length, 2);
});
