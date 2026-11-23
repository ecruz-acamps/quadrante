// Microsoft Entra ID (antigo Azure AD): login "Entrar com Microsoft" e a conexão com o OneDrive.
// Um único registro de aplicativo no Entra serve para os dois. O login é restrito ao tenant da organização
// (ENTRA_TENANT_ID): contas de fora não entram.
//
// Variáveis no .env:
//   ENTRA_TENANT_ID       ID do diretório (tenant)
//   ENTRA_CLIENT_ID       ID do aplicativo (cliente)
//   ENTRA_CLIENT_SECRET   segredo do cliente
//   ENTRA_REDIRECT_URI    https://<endereço>/api/auth/microsoft/callback
//   ONEDRIVE_REDIRECT_URI https://<endereço>/api/onedrive/callback

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada`);
  return value;
}

const base = () => `https://login.microsoftonline.com/${encodeURIComponent(requireEnv("ENTRA_TENANT_ID"))}/oauth2/v2.0`;

export function entraConfigurado(): boolean {
  return Boolean(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);
}

// ---------- login ----------

export function buildLoginUrl(state: string, nonce: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("ENTRA_CLIENT_ID"),
    redirect_uri: requireEnv("ENTRA_REDIRECT_URI"),
    response_type: "code",
    response_mode: "query",
    scope: "openid profile email",
    prompt: "select_account",
    state,
    nonce,
  });
  return `${base()}/authorize?${params.toString()}`;
}

export type ClaimsIdToken = {
  aud?: string;
  iss?: string;
  tid?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
};

// O id_token chega direto do endpoint de token da Microsoft, por HTTPS e com o segredo do cliente: a própria
// conexão garante a origem (OpenID Connect Core 3.1.3.7). Aqui só lemos o conteúdo e conferimos os campos.
export function lerClaimsIdToken(idToken: string): ClaimsIdToken {
  const partes = idToken.split(".");
  if (partes.length !== 3) throw new Error("id_token malformado");
  return JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")) as ClaimsIdToken;
}

export type ResultadoClaims = { ok: true; email: string; nome: string } | { ok: false; motivo: string };

export function validarClaims(
  c: ClaimsIdToken,
  esperado: { tenantId: string; clientId: string; nonce: string; agoraSeg: number },
): ResultadoClaims {
  const tenant = esperado.tenantId.toLowerCase();
  if (c.aud !== esperado.clientId) return { ok: false, motivo: "aud" };
  if (c.tid?.toLowerCase() !== tenant) return { ok: false, motivo: "tenant" };
  if (c.iss?.toLowerCase() !== `https://login.microsoftonline.com/${tenant}/v2.0`) return { ok: false, motivo: "iss" };
  if (!c.exp || c.exp < esperado.agoraSeg) return { ok: false, motivo: "exp" };
  if (!c.nonce || c.nonce !== esperado.nonce) return { ok: false, motivo: "nonce" };
  const email = (c.email || c.preferred_username || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, motivo: "email" };
  return { ok: true, email, nome: c.name?.trim() || email };
}

// ---------- tokens ----------

export type TokensMicrosoft = { access_token: string; id_token?: string; refresh_token?: string; expires_in: number };

async function pedirToken(corpo: Record<string, string>, f: typeof fetch = fetch): Promise<TokensMicrosoft> {
  const res = await f(`${base()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("ENTRA_CLIENT_ID"),
      client_secret: requireEnv("ENTRA_CLIENT_SECRET"),
      ...corpo,
    }),
  });
  if (!res.ok) throw new Error(`A Microsoft recusou o pedido de token (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<TokensMicrosoft>;
}

export function trocarCodigoLogin(code: string) {
  return pedirToken({ code, redirect_uri: requireEnv("ENTRA_REDIRECT_URI"), grant_type: "authorization_code", scope: "openid profile email" });
}

// ---------- OneDrive (permissão delegada da conta que conectar) ----------
// Files.ReadWrite.All: arquivos da própria conta e das pastas/bibliotecas do SharePoint a que ela tem acesso.
// offline_access: devolve o refresh_token que deixa o sistema trabalhar sem a pessoa logada.
export const ESCOPO_ONEDRIVE = "offline_access User.Read Files.ReadWrite.All";

export function buildOneDriveUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("ENTRA_CLIENT_ID"),
    redirect_uri: requireEnv("ONEDRIVE_REDIRECT_URI"),
    response_type: "code",
    response_mode: "query",
    scope: ESCOPO_ONEDRIVE,
    prompt: "select_account",
    state,
  });
  return `${base()}/authorize?${params.toString()}`;
}

export function trocarCodigoOneDrive(code: string) {
  return pedirToken({ code, redirect_uri: requireEnv("ONEDRIVE_REDIRECT_URI"), grant_type: "authorization_code", scope: ESCOPO_ONEDRIVE });
}

export function renovarTokenOneDrive(refreshToken: string, f: typeof fetch = fetch) {
  return pedirToken({ refresh_token: refreshToken, grant_type: "refresh_token", scope: ESCOPO_ONEDRIVE }, f);
}
