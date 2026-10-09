import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { acessoRegistros } from "@/lib/autorizacao";
import { atualizarServo } from "@/lib/actions";
import ServoForm from "../ServoForm";
import ServoFormClient from "../ServoFormClient";
import { notFound } from "next/navigation";

export default async function EditarServoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUser();
  const { id } = await params;
  if (!(await acessoRegistros(usuario, ["servo", Number(id)]))) notFound();
  const servo = await db.servo.findUnique({ where: { id: Number(id) }, include: { pessoa: true } });
  if (!servo) notFound();
  const setores = await db.setor.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-6">Editar servo</h1>
      <ServoFormClient action={atualizarServo} pessoaNome={servo.pessoa.nome}>
        <input type="hidden" name="id" value={servo.id} />
        <ServoForm servo={servo} pessoa={servo.pessoa} setores={setores} />
      </ServoFormClient>
    </div>
  );
}
