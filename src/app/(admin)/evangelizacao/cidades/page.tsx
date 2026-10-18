import Link from "next/link";
import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { carregarPainel } from "@/lib/evangelizacaoDados";
import { AssociarApelido, EditorVizinhanca } from "./Formularios";

export default async function CidadesEvangelizacaoPage() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const [painel, cidades] = await Promise.all([
    carregarPainel(missao.id),
    db.cidade.findMany({ orderBy: { nome: "asc" }, include: { vizinhas: true } }),
  ]);
  const lista = cidades.map((c) => ({ id: c.id, nome: c.nome }));

  return (
    <div>
      <p className="text-sm mb-2">
        <Link href="/evangelizacao" className="underline">
          ← Evangelização
        </Link>
      </p>
      <h1 className="page-title mb-6">Cidades e vizinhança</h1>

      <div className="card p-4 mb-6">
        <h2 className="font-medium mb-1 text-[var(--ink)]">
          Grafias não reconhecidas ({painel.cidadesDesconhecidas.length})
        </h2>
        <p className="text-xs text-[var(--ink-soft)]/70 mb-3">
          Cidades escritas de um jeito que o sistema não conhece. Servo com cidade não reconhecida fica fora do sorteio e
          ficha com cidade não reconhecida vira pendência. Associe a grafia a uma cidade da lista.
        </p>
        {painel.cidadesDesconhecidas.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]/60">Todas as cidades da missão foram reconhecidas.</p>
        ) : (
          <ul className="space-y-2">
            {painel.cidadesDesconhecidas.map((d) => (
              <li key={d.texto} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{d.texto}</span>
                <span className="text-xs text-[var(--ink-soft)]/60">
                  {d.fichas} ficha(s) · {d.servos} servo(s)
                </span>
                <AssociarApelido texto={d.texto} cidades={lista} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4 mb-4 border border-[var(--brass)]/40">
        <p className="text-sm text-[var(--ink)]">
          <strong>Vizinhança não conferida.</strong> A tabela inicial é um rascunho: confira cada cidade e ajuste as
          vizinhas antes de confiar na preferência por cidade próxima.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {cidades.map((c) => (
          <EditorVizinhanca key={c.id} cidade={{ id: c.id, nome: c.nome }} cidades={lista} vizinhasIds={c.vizinhas.map((v) => v.vizinhaId)} />
        ))}
      </div>
    </div>
  );
}
