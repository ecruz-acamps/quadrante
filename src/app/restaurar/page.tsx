import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sistemaVazio } from "@/lib/sistemaVazio";
import { lerStatusTunel } from "@/lib/auxiliarTunel";
import RestaurarForm from "./RestaurarForm";

export const metadata = { title: "Restaurar o Quadrante" };

// Só existe enquanto não há nenhum usuário; depois disso responde 404.
export default async function RestaurarPage() {
  await connection();
  if (!(await sistemaVazio())) notFound();
  const tunel = await lerStatusTunel();
  return <RestaurarForm tunel={{ ...tunel, hostname: process.env.TUNEL_HOSTNAME ?? null }} />;
}
