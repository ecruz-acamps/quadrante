import { NextResponse, type NextRequest } from "next/server";

// Grava o caminho da requisição num cabeçalho interno (sobrescrevendo qualquer valor vindo do cliente),
// para o servidor poder restringir o perfil SERVO_SECRETARIA a algumas áreas.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-qd-caminho", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

// api/restaurar fica de fora: o proxy bufferizaria o corpo do envio e o limitaria a 10 MB (o backup pode ser maior).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/restaurar).*)"],
};
