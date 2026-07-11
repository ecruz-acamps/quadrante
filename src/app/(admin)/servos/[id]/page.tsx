import { db } from "@/lib/db";
import { atualizarServo } from "@/lib/actions";
import ServoForm from "../ServoForm";
import { notFound } from "next/navigation";

export default async function EditarServoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const servo = await db.servo.findUnique({ where: { id: Number(id) }, include: { pessoa: true } });
  if (!servo) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Editar servo</h1>
      <form action={atualizarServo} className="card p-6 space-y-4">
        <input type="hidden" name="id" value={servo.id} />
        <ServoForm servo={servo} pessoa={servo.pessoa} />
        <button className="btn-primary px-6 py-2">Salvar</button>
      </form>
    </div>
  );
}
