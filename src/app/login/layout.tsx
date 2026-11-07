import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sistemaVazio } from "@/lib/sistemaVazio";

// Sistema recém-instalado (sem nenhum usuário): em vez do login, leva à tela de restauração.
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  await connection(); // consulta o banco a cada acesso, nunca em cache de build
  if (await sistemaVazio()) redirect("/restaurar");
  return children;
}
