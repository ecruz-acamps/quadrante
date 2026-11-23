// Configuração do aplicativo do Microsoft Entra pela tela (Configurações › Microsoft), no lugar de editar o .env.
// Os valores vão para o .env e para process.env na hora: o login e o OneDrive leem dali a cada uso, sem reiniciar.

export const CHAVES_ENTRA = ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_CLIENT_SECRET", "ENTRA_REDIRECT_URI", "ONEDRIVE_REDIRECT_URI"] as const;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// o .env guarda o valor entre aspas e o Next expande $VAR: aspas, barra invertida, $ e quebra de linha ficam de fora
const SEGREDO = /^[^\s"'\\$`]{8,200}$/;

export const CAMINHO_LOGIN = "/api/auth/microsoft/callback";
export const CAMINHO_ONEDRIVE = "/api/onedrive/callback";

export function urlsSugeridas(hostname: string | undefined | null) {
  const h = hostname?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!h) return null;
  return { login: `https://${h}${CAMINHO_LOGIN}`, onedrive: `https://${h}${CAMINHO_ONEDRIVE}` };
}

export type EntradaEntra = { tenantId: string; clientId: string; segredo: string; urlLogin: string; urlOneDrive: string };
export type ValoresEntra = Record<(typeof CHAVES_ENTRA)[number], string>;

function urlValida(u: string, caminho: string) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.pathname === caminho && !url.search && !url.hash;
  } catch {
    return false;
  }
}

// segredoAtual: o que já está gravado; segredo em branco na tela quer dizer "manter".
export function validarEntra(e: EntradaEntra, segredoAtual: string | undefined): { erro: string } | { valores: ValoresEntra } {
  const tenantId = e.tenantId.trim();
  const clientId = e.clientId.trim();
  const segredo = e.segredo.trim() || segredoAtual || "";
  const urlLogin = e.urlLogin.trim();
  const urlOneDrive = e.urlOneDrive.trim();
  if (!GUID.test(tenantId)) return { erro: "ID do diretório (locatário) inválido: copie da Visão geral do aplicativo (formato 00000000-0000-0000-0000-000000000000)." };
  if (!GUID.test(clientId)) return { erro: "ID do aplicativo (cliente) inválido: copie da Visão geral do aplicativo." };
  if (!segredo) return { erro: "Informe o segredo do cliente (o Valor, em Certificados e segredos)." };
  if (GUID.test(segredo)) return { erro: 'Isso parece o "ID do segredo". Copie o campo "Valor" do segredo (ele só aparece logo depois de criar).' };
  if (!SEGREDO.test(segredo)) return { erro: "Segredo do cliente com formato inesperado. Copie o Valor de novo, sem espaços." };
  if (!urlValida(urlLogin, CAMINHO_LOGIN)) return { erro: `URI de retorno do login inválida: use https://SEU-ENDERECO${CAMINHO_LOGIN}` };
  if (!urlValida(urlOneDrive, CAMINHO_ONEDRIVE)) return { erro: `URI de retorno do OneDrive inválida: use https://SEU-ENDERECO${CAMINHO_ONEDRIVE}` };
  return {
    valores: {
      ENTRA_TENANT_ID: tenantId.toLowerCase(),
      ENTRA_CLIENT_ID: clientId.toLowerCase(),
      ENTRA_CLIENT_SECRET: segredo,
      ENTRA_REDIRECT_URI: urlLogin,
      ONEDRIVE_REDIRECT_URI: urlOneDrive,
    },
  };
}

// Pede à Microsoft um token só do aplicativo (client_credentials): confirma diretório, aplicativo e segredo
// sem precisar de ninguém logado. Não dá acesso a nada (o app não tem permissões de aplicativo).
export async function testarCredenciais(
  v: Pick<ValoresEntra, "ENTRA_TENANT_ID" | "ENTRA_CLIENT_ID" | "ENTRA_CLIENT_SECRET">,
  f: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  let res: Response;
  try {
    res = await f(`https://login.microsoftonline.com/${encodeURIComponent(v.ENTRA_TENANT_ID)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: v.ENTRA_CLIENT_ID,
        client_secret: v.ENTRA_CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    });
  } catch {
    return { ok: false, erro: "Não foi possível falar com a Microsoft a partir deste servidor (rede). Nada foi gravado." };
  }
  if (res.ok) return { ok: true };
  let descricao = "";
  try {
    descricao = ((await res.json()) as { error_description?: string }).error_description ?? "";
  } catch {
    // corpo sem JSON
  }
  return { ok: false, erro: explicarErro(descricao, res.status) };
}

export function explicarErro(descricao: string, status: number): string {
  const codigo = /AADSTS(\d+)/.exec(descricao)?.[1];
  const porCodigo: Record<string, string> = {
    "90002": "ID do diretório (locatário) não encontrado na Microsoft.",
    "900023": "ID do diretório (locatário) inválido.",
    "700016": "ID do aplicativo (cliente) não encontrado nesse diretório. Confira os dois IDs na Visão geral do aplicativo.",
    "7000215": 'Segredo do cliente inválido. Use o campo "Valor" (não o "ID do segredo") e confira se é deste aplicativo.',
    "7000222": "O segredo do cliente venceu. Crie outro em Certificados e segredos e cole aqui.",
    "7000112": "O aplicativo está desativado no Entra.",
  };
  const texto = codigo ? porCodigo[codigo] : undefined;
  return `${texto ?? "A Microsoft recusou as credenciais."}${codigo ? ` (AADSTS${codigo})` : ` (HTTP ${status})`} Nada foi gravado.`;
}
