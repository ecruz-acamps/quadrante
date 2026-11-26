import Link from "next/link";
import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resumoNucleos } from "@/lib/controleNucleos";
import RecebidasInput from "./RecebidasInput";

// Controle por núcleo: quantas fichas cada núcleo recebeu (digitado aqui) x quantas já estão cadastradas.
export default async function ControleNucleosPage() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const [recebidas, contagem] = await Promise.all([
    db.nucleoFichas.findMany({ where: { missaoId: missao.id } }),
    db.neocampista.groupBy({ by: ["nucleo"], where: { missaoId: missao.id }, _count: true }),
  ]);
  const { linhas, total } = resumoNucleos(
    new Map(recebidas.map((r) => [r.nucleo, r.recebidas])),
    new Map(contagem.map((c) => [c.nucleo, c._count])),
  );

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="page-title">Controle de fichas por núcleo</h1>
        <Link href="/fichas" className="btn-link text-sm">
          ← Fichas
        </Link>
      </div>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-4">
        Digite em <strong>Recebeu</strong> quantas fichas cada núcleo recebeu (salva ao sair do campo). <strong>Cadastradas</strong> conta as
        fichas do núcleo já lançadas no sistema; <strong>Faltam</strong> é a diferença. Vale para a missão {missao.nome}.
      </p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="qd-thead">
              <tr>
                <th className="text-left px-4 py-2">Núcleo</th>
                <th className="text-left px-4 py-2">Recebeu</th>
                <th className="text-right px-4 py-2">Cadastradas</th>
                <th className="text-right px-4 py-2">Faltam</th>
                <th className="px-4 py-2 w-40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {linhas.map((l) => {
                const pct = l.recebidas > 0 ? Math.min(100, Math.round((l.cadastradas / l.recebidas) * 100)) : 0;
                return (
                  <tr key={l.nucleo}>
                    <td className="px-4 py-2">
                      {l.nucleo}
                      {l.foraDaLista && <span className="ml-2 text-xs text-[var(--ink-soft)]/60">(fora da lista)</span>}
                    </td>
                    <td className="px-4 py-1.5">
                      <RecebidasInput missaoId={missao.id} nucleo={l.nucleo} valor={l.recebidas} />
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{l.cadastradas}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {l.aMais > 0 ? (
                        <span className="text-[var(--signal)]" title="Mais fichas cadastradas do que recebidas: confira o núcleo das fichas ou o número recebido">
                          +{l.aMais} a mais
                        </span>
                      ) : l.recebidas === 0 ? (
                        <span className="text-[var(--ink-soft)]/40 font-normal">—</span>
                      ) : l.faltam === 0 ? (
                        <span className="text-green-700">completo</span>
                      ) : (
                        l.faltam
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {l.recebidas > 0 && (
                        <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden" title={`${pct}%`}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: l.faltam === 0 ? "#2E7D46" : "var(--brass)" }} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--paper)] font-bold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 font-mono">{total.recebidas}</td>
                <td className="px-4 py-2 text-right font-mono">{total.cadastradas}</td>
                <td className="px-4 py-2 text-right font-mono">{total.faltam}</td>
                <td className="px-4 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
