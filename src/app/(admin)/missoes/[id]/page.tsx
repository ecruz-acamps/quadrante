import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import EditarMissaoForm from "./EditarMissaoForm";

export default async function EditarMissaoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER");
  const { id } = await params;
  const missao = await db.missao.findUnique({ where: { id: Number(id) } });
  if (!missao) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="page-title mb-6">Editar missão</h1>
      <EditarMissaoForm missao={missao} />
    </div>
  );
}
