import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import EditarUsuarioForm from "./EditarUsuarioForm";

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("SUPER");
  const { id } = await params;
  const usuario = await db.usuario.findUnique({
    where: { id: Number(id) },
    include: { missoes: true },
  });
  if (!usuario) notFound();
  const missoes = await db.missao.findMany({ orderBy: { id: "desc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="page-title mb-6">Editar usuário</h1>
      <EditarUsuarioForm
        usuario={{
          id: usuario.id,
          nome: usuario.nome,
          role: usuario.role,
          missaoIds: usuario.missoes.map((v) => v.missaoId),
        }}
        missoes={missoes}
      />
    </div>
  );
}
