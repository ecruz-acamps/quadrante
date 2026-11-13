import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Cabeçalhos de segurança. A CSP aqui cobre só frame-ancestors (anti-clickjacking): uma CSP completa
// para scripts exige nonce por requisição e fica para um passo à parte.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // sem includeSubDomains: o domínio raiz tem outros sistemas
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
];

const nextConfig: NextConfig = {
  // A atualização pela interface compila em outra pasta (QUADRANTE_DIST_DIR=.next-novo) enquanto o sistema
  // segue no ar com a .next atual; no fim as pastas são trocadas e o app reinicia. Sem a variável, usa .next.
  distDir: process.env.QUADRANTE_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Sem SENTRY_AUTH_TOKEN o build não envia source maps (os erros chegam, só que minificados).
export default withSentryConfig(nextConfig, {
  org: "acampamentos",
  project: "quadrantes",
  silent: true,
  telemetry: false,
});
