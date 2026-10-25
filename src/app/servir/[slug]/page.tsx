import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { garantirPerguntasIniciais, listarPerguntasAtivas } from "@/lib/servirPerguntasDb";
import ServirForm from "./ServirForm";

export default async function ServirPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const missao = await db.missao.findUnique({ where: { cercoSlug: slug } });
  if (!missao) notFound();

  if (!missao.servirPublicado) {
    return (
      <main className="min-h-screen bg-[var(--ink)] p-4 md:p-10 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--brass-bright)] mb-2">{missao.nome}</p>
          <h1 className="font-[var(--font-spectral)] text-3xl text-[var(--paper)] mb-3">Quero servir</h1>
          <p className="text-sm text-[var(--paper)]/70">Inscrições encerradas no momento.</p>
        </div>
      </main>
    );
  }

  await garantirPerguntasIniciais(db);
  const perguntas = await listarPerguntasAtivas(db);

  return (
    <main className="min-h-screen bg-[var(--ink)] p-4 md:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--brass-bright)] mb-2">{missao.nome}</p>
          <h1 className="font-[var(--font-spectral)] text-4xl text-[var(--paper)]">Quero servir</h1>
          <p className="text-sm text-[var(--paper)]/70 mt-3 max-w-md mx-auto">
            Você gostaria de trabalhar nos acampamentos? Preencha os dados abaixo para se disponibilizar a servir.
          </p>
        </div>
        <ServirForm
          missaoId={missao.id}
          missaoNome={missao.nome}
          datas={missao.servirDatas}
          perguntas={perguntas}
        />
      </div>
    </main>
  );
}
