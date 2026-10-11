import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import FichaCampos from "./FichaCampos";

export default async function GeradorFichasPage() {
  await requireRole("SUPER");
  const missoes = await db.missao.findMany({
    orderBy: [{ ano: "desc" }, { id: "desc" }],
    select: { id: true, nome: true, ano: true, dataInicio: true, dataFim: true, valorCampista: true, pixChave: true, contatoFinanceiro: true },
  });
  return (
    <div className="max-w-xl">
      <h1 className="page-title mb-2">Gerador de Fichas</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-6">
        Gera as fichas de inscrição em PDF, idênticas ao modelo. Muda o número da missão, as datas, o valor, o PIX, o contato do financeiro e o número da ficha.
        Todas as fichas saem em um único arquivo ZIP.
      </p>
      <form action="/gerador-fichas/gerar" method="get" className="card p-5 grid grid-cols-2 gap-4">
        <FichaCampos missoes={missoes} />
        <div className="col-span-2">
          <button className="btn-primary">Gerar e baixar ZIP</button>
        </div>
      </form>
    </div>
  );
}
