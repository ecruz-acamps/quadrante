// Cliente mínimo da API da Cloudflare (tokens de API, túneis e DNS). `fetch` é injetado para poder ser simulado nos testes.
// O token da API NUNCA entra em mensagem de erro, log ou retorno.
const BASE = "https://api.cloudflare.com/client/v4";

export type FetchFn = typeof fetch;

export class ErroCloudflare extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroCloudflare";
  }
}

const PERMISSOES = "Conta › Cloudflare Tunnel › Editar, Zona › DNS › Editar e Zona › Zona › Leitura";

type Envelope<T> = { success?: boolean; result?: T; errors?: { code?: number; message?: string }[] } | null;

async function chamar<T>(f: FetchFn, token: string, metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await f(BASE + caminho, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroCloudflare(0, "Não foi possível falar com a Cloudflare. Confira a conexão do servidor com a internet.");
  }
  const json = (await resp.json().catch(() => null)) as Envelope<T>;
  if (resp.ok && json?.success) return json.result as T;
  if (resp.status === 401) throw new ErroCloudflare(401, "O token da API é inválido ou expirou.");
  if (resp.status === 403) throw new ErroCloudflare(403, `O token não tem permissão para isso. Ele precisa de: ${PERMISSOES}.`);
  const detalhe = json?.errors?.map((e) => e.message).filter(Boolean).join("; ") || `código ${resp.status}`;
  throw new ErroCloudflare(resp.status, `A Cloudflare recusou o pedido: ${detalhe}`);
}

const ROTULO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// endereço público: minúsculas, ao menos 2 rótulos, sem curinga/espaço/barra/dois-pontos/quebra de linha
export function hostnameValido(h: string): boolean {
  if (h.length === 0 || h.length > 253) return false;
  const rotulos = h.split(".");
  return rotulos.length >= 2 && rotulos.every((r) => r.length <= 63 && ROTULO.test(r));
}

// Tokens de conta (prefixo cfat_) não usam /user/tokens/verify; neles a validação acontece na busca da zona.
export async function verificarToken(f: FetchFn, token: string): Promise<void> {
  if (token.startsWith("cfat_")) return;
  await chamar(f, token, "GET", "/user/tokens/verify");
}

type ZonaApi = { id: string; account: { id: string } };

// procura a zona dona do endereço, do sufixo mais longo ao mais curto (a.b.exemplo.com → b.exemplo.com → exemplo.com)
export async function localizarZona(f: FetchFn, token: string, hostname: string): Promise<{ contaId: string; zonaId: string }> {
  const rotulos = hostname.split(".");
  for (let i = 0; i < rotulos.length - 1; i++) {
    const nome = rotulos.slice(i).join(".");
    const zonas = await chamar<ZonaApi[]>(f, token, "GET", `/zones?name=${encodeURIComponent(nome)}`);
    if (zonas.length > 0) return { contaId: zonas[0].account.id, zonaId: zonas[0].id };
  }
  throw new ErroCloudflare(404, "Domínio não encontrado nesta conta da Cloudflare.");
}

export async function lerRegistroDns(
  f: FetchFn,
  token: string,
  zonaId: string,
  hostname: string,
): Promise<{ id: string; tipo: string; conteudo: string } | null> {
  const registros = await chamar<{ id: string; type: string; content: string }[]>(
    f,
    token,
    "GET",
    `/zones/${zonaId}/dns_records?name=${encodeURIComponent(hostname)}`,
  );
  const r = registros[0];
  return r ? { id: r.id, tipo: r.type, conteudo: r.content } : null;
}

export async function criarTunel(f: FetchFn, token: string, contaId: string, nome: string): Promise<{ id: string; tokenTunel: string }> {
  const criado = await chamar<{ id: string; token?: string }>(f, token, "POST", `/accounts/${contaId}/cfd_tunnel`, {
    name: nome,
    config_src: "cloudflare",
  });
  const tokenTunel = criado.token ?? (await chamar<string>(f, token, "GET", `/accounts/${contaId}/cfd_tunnel/${criado.id}/token`));
  return { id: criado.id, tokenTunel };
}

export async function definirRota(
  f: FetchFn,
  token: string,
  contaId: string,
  tunelId: string,
  hostname: string,
  servico: string,
): Promise<void> {
  await chamar(f, token, "PUT", `/accounts/${contaId}/cfd_tunnel/${tunelId}/configurations`, {
    config: { ingress: [{ hostname, service: servico }, { service: "http_status:404" }] },
  });
}

export async function gravarRegistroDns(
  f: FetchFn,
  token: string,
  zonaId: string,
  hostname: string,
  tunelId: string,
  existenteId?: string,
): Promise<void> {
  const corpo = { type: "CNAME", name: hostname, content: `${tunelId}.cfargotunnel.com`, proxied: true };
  if (existenteId) await chamar(f, token, "PUT", `/zones/${zonaId}/dns_records/${existenteId}`, corpo);
  else await chamar(f, token, "POST", `/zones/${zonaId}/dns_records`, corpo);
}
