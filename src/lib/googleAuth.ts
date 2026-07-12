// Login "Entrar com Google" restrito ao domínio do GSuite do acampamento.
// Quem é admin do Google Workspace vira SUPER automaticamente; os demais viram ADMIN.
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada`);
  return value;
}

export function getRedirectUri() {
  return requireEnv("GOOGLE_REDIRECT_URI");
}

export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    access_type: "online",
    prompt: "select_account",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/admin.directory.user.readonly",
    ].join(" "),
    state,
    hd: process.env.GSUITE_DOMAIN || "",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar código por token: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; id_token: string }>;
}

export async function getGoogleUserInfo(accessToken: string) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Falha ao obter dados do usuário: ${await res.text()}`);
  return res.json() as Promise<{ email: string; email_verified: boolean; name: string; hd?: string }>;
}

// Consulta o Admin SDK Directory API para saber se o usuário é admin do Workspace.
// Um usuário comum consegue ler o próprio registro; se a chamada falhar (API não
// habilitada, escopo negado, etc.) tratamos como "não é admin" em vez de travar o login.
export async function checkIsWorkspaceAdmin(accessToken: string, email: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { isAdmin?: boolean };
    return Boolean(data.isAdmin);
  } catch {
    return false;
  }
}
