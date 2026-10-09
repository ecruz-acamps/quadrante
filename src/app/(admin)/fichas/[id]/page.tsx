import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { acessoRegistros } from "@/lib/autorizacao";
import { atualizarFicha } from "@/lib/actions";
import FichaForm from "../FichaForm";
import { notFound } from "next/navigation";

export default async function EditarFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUser();
  const { id } = await params;
  if (!(await acessoRegistros(usuario, ["ficha", Number(id)]))) notFound();
  const ficha = await db.neocampista.findUnique({ where: { id: Number(id) } });
  if (!ficha) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-6">Editar ficha #{ficha.numero}</h1>
      <form action={atualizarFicha} className="card p-6 space-y-4">
        <input type="hidden" name="id" value={ficha.id} />
        <FichaForm ficha={ficha} />
        <button className="btn-primary px-6 py-2">Salvar</button>
      </form>
    </div>
  );
}
