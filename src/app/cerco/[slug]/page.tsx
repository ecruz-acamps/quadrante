import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import CercoForm from "./CercoForm";

export default async function CercoPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const missao = await db.missao.findUnique({ where: { cercoSlug: slug } });
  if (!missao) notFound();

  if (!missao.cercoPublicado) {
    return (
      <main className="min-h-screen bg-[var(--ink)] p-4 md:p-10 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--brass-bright)] mb-2">
            {missao.nome}
          </p>
          <h1 className="font-[var(--font-spectral)] text-3xl text-[var(--paper)] mb-3">Cerco de Jericó</h1>
          <p className="text-sm text-[var(--paper)]/70">Inscrições encerradas no momento.</p>
        </div>
      </main>
    );
  }

  const ocupacao = await db.servo.groupBy({
    by: ["cercoHorario"],
    where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } },
    _count: true,
  });
  const ocupados = new Map(ocupacao.map((o) => [o.cercoHorario, o._count]));

  return (
    <main className="min-h-screen bg-[var(--ink)] p-4 md:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--brass-bright)] mb-2">
            {missao.nome}
          </p>
          <h1 className="font-[var(--font-spectral)] text-4xl text-[var(--paper)]">Cerco de Jericó</h1>
          <p className="text-sm text-[var(--paper)]/70 mt-3 max-w-md mx-auto">
            Vigília de oração de 24 horas diante do Santíssimo Sacramento. Digite seu nome, escolha
            sua hora e reserve 1 hora de adoração.
          </p>
        </div>

        <CercoForm
          missaoId={missao.id}
          maxPorHorario={missao.cercoMaxPorHorario}
          ocupados={Object.fromEntries(ocupados)}
        />
      </div>
    </main>
  );
}
