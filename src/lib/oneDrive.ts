// OneDrive / SharePoint pelo Microsoft Graph, com a permissão delegada da conta conectada em Configurações.
// Usado pelas fichas preenchidas (src/lib/fichaArquivos.ts) e pelo backup diário (scripts/backup-to-drive.ts).
//
// Pasta raiz: por padrão "Quadrante" no OneDrive da conta. Em Configurações dá para colar o link de outra pasta,
// do OneDrive ou de uma biblioteca do SharePoint; os caminhos (missão/Fichas, missão/Tribos/AZUL, Backups) ficam
// dentro dela.
import type { PrismaClient } from "@prisma/client";
import { renovarTokenOneDrive } from "./microsoftAuth";

const GRAPH = "https://graph.microsoft.com/v1.0";
export const PASTA_PADRAO = "Quadrante";

export type Ref = { driveId: string; id: string };
export type Item = Ref & { name: string; webUrl?: string; size?: number; createdDateTime?: string };

// O que as fichas e o backup precisam; os testes trocam por uma versão em memória.
export interface Arquivos {
  garantirPasta(caminho: string[]): Promise<Ref>;
  listar(pasta: Ref): Promise<Item[]>;
  enviar(pasta: Ref, nome: string, conteudo: Buffer, seExistir: "rename" | "replace"): Promise<Item>;
  renomear(item: Ref, nome: string): Promise<Item>;
  baixar(item: Ref): Promise<Buffer>;
  substituir(item: Ref, conteudo: Buffer): Promise<Item>; // troca o conteúdo mantendo o mesmo arquivo (e link)
  apagar(item: Ref): Promise<void>; // vai para a lixeira do OneDrive; já apagado não é erro
}

export class ErroOneDrive extends Error {
  constructor(
    mensagem: string,
    readonly status = 0,
    readonly codigo = "",
  ) {
    super(mensagem);
    this.name = "ErroOneDrive";
  }
}

// ---------- nomes ----------

// O OneDrive recusa " * : < > ? / \ | , nomes terminados em ponto ou espaço e alguns nomes reservados.
export function nomeSeguro(nome: string, max = 200): string {
  let n = nome
    .normalize("NFC")
    .replace(/["*:<>?/\\|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
  if (!n || /^(con|prn|aux|nul|com\d|lpt\d|\.lock|desktop\.ini)$/i.test(n) || n.startsWith("~$")) n = `_${n || "arquivo"}`;
  return n.slice(0, max).trim();
}

// ---------- token ----------

type Db = Pick<PrismaClient, "integracaoOneDrive">;

let tokenEmCache: { valor: string; expiraEm: number } | null = null;
let renovando: Promise<string> | null = null;

export function esquecerTokenEmCache() {
  tokenEmCache = null;
}

async function obterToken(db: Db, f: typeof fetch): Promise<string> {
  if (tokenEmCache && tokenEmCache.expiraEm > Date.now() + 60_000) return tokenEmCache.valor;
  if (renovando) return renovando;
  renovando = (async () => {
    const integ = await db.integracaoOneDrive.findUnique({ where: { id: 1 } });
    if (!integ) throw new ErroOneDrive('O OneDrive não está conectado. Em Configurações, clique em "Conectar OneDrive".');
    let t;
    try {
      t = await renovarTokenOneDrive(integ.refreshToken, f);
    } catch (e) {
      throw new ErroOneDrive(`Não foi possível renovar o acesso ao OneDrive; reconecte em Configurações. (${(e as Error).message})`);
    }
    // a Microsoft costuma devolver um refresh token novo: guarda para a próxima vez
    if (t.refresh_token && t.refresh_token !== integ.refreshToken) {
      await db.integracaoOneDrive.update({ where: { id: 1 }, data: { refreshToken: t.refresh_token } });
    }
    tokenEmCache = { valor: t.access_token, expiraEm: Date.now() + t.expires_in * 1000 };
    return t.access_token;
  })().finally(() => {
    renovando = null;
  });
  return renovando;
}

// ---------- chamadas ----------

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function criarClienteGraph(db: Db, f: typeof fetch = fetch) {
  async function chamar(metodo: string, caminho: string, corpo?: unknown, extra: RequestInit = {}): Promise<Response> {
    for (let tentativa = 0; ; tentativa++) {
      const token = await obterToken(db, f);
      const binario = Buffer.isBuffer(corpo);
      const res = await f(caminho.startsWith("http") ? caminho : `${GRAPH}${caminho}`, {
        method: metodo,
        ...extra,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(corpo !== undefined ? { "Content-Type": binario ? "application/octet-stream" : "application/json" } : {}),
          ...(extra.headers ?? {}),
        },
        body: corpo === undefined ? undefined : binario ? new Uint8Array(corpo as Buffer) : JSON.stringify(corpo),
      });
      if (res.status === 401 && tentativa === 0) {
        esquecerTokenEmCache();
        continue;
      }
      // limite de uso ou instabilidade: espera o que a Microsoft pedir e tenta de novo
      if ((res.status === 429 || res.status === 503 || res.status === 504) && tentativa < 4) {
        const segundos = Number(res.headers.get("Retry-After")) || 2 ** tentativa;
        await esperar(Math.min(segundos, 30) * 1000);
        continue;
      }
      return res;
    }
  }

  async function json<T>(res: Response, oQue: string): Promise<T> {
    if (res.ok) return (await res.json()) as T;
    let codigo = "";
    let msg = "";
    try {
      const e = (await res.json()) as { error?: { code?: string; message?: string } };
      codigo = e.error?.code ?? "";
      msg = e.error?.message ?? "";
    } catch {
      // corpo sem JSON
    }
    throw new ErroOneDrive(`OneDrive: falha ao ${oQue} (${res.status}${codigo ? ` ${codigo}` : ""})${msg ? `: ${msg}` : ""}`, res.status, codigo);
  }

  const paraItem = (x: { id: string; name: string; webUrl?: string; size?: number; createdDateTime?: string; parentReference?: { driveId?: string } }, driveId?: string): Item => ({
    driveId: x.parentReference?.driveId ?? driveId ?? "",
    id: x.id,
    name: x.name,
    webUrl: x.webUrl,
    size: x.size,
    createdDateTime: x.createdDateTime,
  });

  let raizDaConta: Ref | null = null; // raiz do OneDrive da conta conectada

  async function raiz(): Promise<Ref> {
    const integ = await db.integracaoOneDrive.findUnique({ where: { id: 1 } });
    if (integ?.raizDriveId && integ.raizId) return { driveId: integ.raizDriveId, id: integ.raizId };
    if (!raizDaConta) {
      const r = await json<{ id: string; parentReference: { driveId: string } }>(await chamar("GET", "/me/drive/root"), "abrir o OneDrive");
      raizDaConta = { driveId: r.parentReference.driveId, id: r.id };
    }
    return subpasta(raizDaConta, PASTA_PADRAO);
  }

  const pastas = new Map<string, Ref>(); // caminho -> pasta, para não perguntar de novo a cada arquivo

  async function subpasta(pai: Ref, nome: string): Promise<Ref> {
    const n = nomeSeguro(nome);
    const chave = `${pai.driveId}/${pai.id}/${n}`;
    const conhecida = pastas.get(chave);
    if (conhecida) return conhecida;
    const caminho = `/drives/${pai.driveId}/items/${pai.id}:/${encodeURIComponent(n)}`;
    let res = await chamar("GET", caminho);
    if (res.status === 404) {
      res = await chamar("POST", `/drives/${pai.driveId}/items/${pai.id}/children`, {
        name: n,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      });
      if (res.status === 409) res = await chamar("GET", caminho); // outra chamada criou ao mesmo tempo
    }
    const item = await json<{ id: string; folder?: object; parentReference?: { driveId?: string } }>(res, `abrir a pasta "${n}"`);
    if (!item.folder) throw new ErroOneDrive(`OneDrive: "${n}" existe mas não é uma pasta.`);
    const ref = { driveId: item.parentReference?.driveId ?? pai.driveId, id: item.id };
    pastas.set(chave, ref);
    return ref;
  }

  const cliente: Arquivos & {
    resolverLinkPasta(link: string): Promise<{ driveId: string; id: string; name: string; webUrl?: string }>;
    urlDaPasta(ref: Ref): Promise<string>;
    esquecerPastas(): void;
  } = {
    // endereço para abrir a pasta no navegador (OneDrive ou SharePoint)
    async urlDaPasta(ref) {
      const item = await json<{ webUrl?: string }>(
        await chamar("GET", `/drives/${ref.driveId}/items/${ref.id}?$select=webUrl`),
        "abrir a pasta",
      );
      if (!item.webUrl) throw new ErroOneDrive("OneDrive: a pasta não tem endereço para abrir.");
      return item.webUrl;
    },
    // uma pasta apagada ou movida à mão no OneDrive deixa o caminho guardado inválido
    esquecerPastas() {
      pastas.clear();
      raizDaConta = null;
    },

    async garantirPasta(caminho) {
      let atual = await raiz();
      for (const parte of caminho) atual = await subpasta(atual, parte);
      return atual;
    },

    async listar(pasta) {
      const itens: Item[] = [];
      let url: string | undefined = `/drives/${pasta.driveId}/items/${pasta.id}/children?$top=200&$select=id,name,webUrl,size,createdDateTime,parentReference`;
      while (url) {
        const pagina: { value: Parameters<typeof paraItem>[0][]; "@odata.nextLink"?: string } = await json(await chamar("GET", url), "listar a pasta");
        itens.push(...pagina.value.map((x) => paraItem(x, pasta.driveId)));
        url = pagina["@odata.nextLink"];
      }
      return itens;
    },

    async enviar(pasta, nome, conteudo, seExistir) {
      const n = nomeSeguro(nome);
      const caminho = `/drives/${pasta.driveId}/items/${pasta.id}:/${encodeURIComponent(n)}:/content?@microsoft.graph.conflictBehavior=${seExistir}`;
      const item = paraItem(await json(await chamar("PUT", caminho, conteudo), `enviar "${n}"`), pasta.driveId);
      if (item.size != null && item.size !== conteudo.length) {
        throw new ErroOneDrive(`OneDrive guardou ${item.size} bytes de "${n}", mas o arquivo tem ${conteudo.length}.`);
      }
      return item;
    },

    async renomear(ref, nome) {
      const n = nomeSeguro(nome);
      const tentar = (nomeFinal: string) => chamar("PATCH", `/drives/${ref.driveId}/items/${ref.id}`, { name: nomeFinal });
      let res = await tentar(n);
      // já existe um arquivo com esse nome na pasta: acrescenta (2), (3)…
      for (let i = 2; res.status === 409 && i < 10; i++) {
        const ponto = n.lastIndexOf(".");
        res = await tentar(ponto > 0 ? `${n.slice(0, ponto)} (${i})${n.slice(ponto)}` : `${n} (${i})`);
      }
      return paraItem(await json(res, `renomear para "${n}"`), ref.driveId);
    },

    async substituir(ref, conteudo) {
      const item = paraItem(await json(await chamar("PUT", `/drives/${ref.driveId}/items/${ref.id}/content`, conteudo), "atualizar o arquivo"), ref.driveId);
      if (item.size != null && item.size !== conteudo.length) {
        throw new ErroOneDrive(`OneDrive guardou ${item.size} bytes, mas o arquivo tem ${conteudo.length}.`);
      }
      return item;
    },

    async baixar(ref) {
      const res = await chamar("GET", `/drives/${ref.driveId}/items/${ref.id}/content`);
      if (!res.ok) await json(res, "baixar o arquivo");
      return Buffer.from(await res.arrayBuffer());
    },

    async apagar(ref) {
      const res = await chamar("DELETE", `/drives/${ref.driveId}/items/${ref.id}`);
      if (res.ok || res.status === 404) return;
      await json(res, "apagar o arquivo");
    },

    // link de compartilhamento de uma pasta (OneDrive ou SharePoint) -> a pasta
    async resolverLinkPasta(link) {
      const codificado = "u!" + Buffer.from(link.trim(), "utf8").toString("base64url");
      const item = await json<{ id: string; name: string; webUrl?: string; folder?: object; parentReference: { driveId: string } }>(
        await chamar("GET", `/shares/${codificado}/driveItem`),
        "abrir o link da pasta",
      );
      if (!item.folder) throw new ErroOneDrive("O link não é de uma pasta. Abra a pasta no OneDrive/SharePoint e copie o link dela.");
      return { driveId: item.parentReference.driveId, id: item.id, name: item.name, webUrl: item.webUrl };
    },

  };
  return cliente;
}

// Um cliente por processo: guarda as pastas já encontradas entre uma ficha e outra.
let unico: ReturnType<typeof criarClienteGraph> | null = null;
export function oneDrive(db: Db) {
  unico ??= criarClienteGraph(db);
  return unico;
}

// depois de conectar outra conta ou trocar a pasta raiz
export function reiniciarOneDrive() {
  unico = null;
  tokenEmCache = null;
}

// e-mail da conta dona de um token recém-emitido (na conexão, antes de gravar nada)
export async function contaDoToken(accessToken: string, f: typeof fetch = fetch): Promise<string> {
  const res = await f(`${GRAPH}/me?$select=mail,userPrincipalName`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new ErroOneDrive(`OneDrive: falha ao ler a conta (${res.status})`, res.status);
  const eu = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return (eu.mail || eu.userPrincipalName || "").toLowerCase();
}
