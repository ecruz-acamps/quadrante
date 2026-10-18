import Link from "next/link";
import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { carregarPainel } from "@/lib/evangelizacaoDados";
import { ApelidosDaCidade, AssociarApelido, EditorVizinhanca } from "./Formularios";

export default async function CidadesEvangelizacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ cidade?: string }>;
}) {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const { cidade: cidadeParam } = await searchParams;
  const [painel, cidades] = await Promise.all([
    carregarPainel(missao.id),
    db.cidade.findMany({ orderBy: { nome: "asc" }, include: { vizinhas: true, apelidos: { orderBy: { apelido: "asc" } } } }),
  ]);
  const lista = cidades.map((c) => ({ id: c.id, nome: c.nome }));
  const escolhida = cidades.find((c) => String(c.id) === cidadeParam) ?? null;

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
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <label className="text-sm" htmlFor="cidade">
          Cidade
        </label>
        <select id="cidade" name="cidade" defaultValue={escolhida?.id ?? ""} className="input py-1 text-sm">
          <option value="">Escolha uma cidade...</option>
          {cidades.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.vizinhas.length ? ` (${c.vizinhas.length} vizinhas)` : ""}
            </option>
          ))}
        </select>
        <button className="btn-primary text-xs px-3 py-1">Abrir</button>
      </form>
      {escolhida && (
        <div>
          <EditorVizinhanca
            key={`${escolhida.id}:${escolhida.vizinhas.map((v) => v.vizinhaId).sort((a, b) => a - b).join(",")}`}
            cidade={{ id: escolhida.id, nome: escolhida.nome }}
            cidades={lista}
            vizinhasIds={escolhida.vizinhas.map((v) => v.vizinhaId)}
          />
          <ApelidosDaCidade key={`ap-${escolhida.id}:${escolhida.apelidos.length}`} apelidos={escolhida.apelidos.map((a) => ({ id: a.id, apelido: a.apelido }))} />
        </div>
      )}
    </div>
  );
}
