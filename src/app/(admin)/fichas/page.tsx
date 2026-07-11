import Link from "next/link";
import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { excluirFicha, adicionarAlerta, removerAlerta } from "@/lib/actions";
import VerEditarFichaButton from "./VerEditarFichaButton";

export default async function FichasPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const fichas = await db.neocampista.findMany({
    where: { missaoId: missao.id },
    include: {
      tribo: true,
      alertas: { include: { alvo: true } },
      alvos: { include: { origem: true } },
    },
    orderBy: { numero: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)]">Fichas dos Núcleos (Neocampistas)</h1>
        <Link href="/fichas/novo" className="btn-primary px-4 py-2 text-sm">
          + Nova ficha
        </Link>
      </div>

      <div className="card overflow-hidden mb-8">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--ink)] text-[var(--paper)]">
            <tr>
              <th className="text-left px-4 py-2">Nº</th>
              <th className="text-left px-4 py-2">Núcleo</th>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">Situação</th>
              <th className="text-left px-4 py-2">Tribo</th>
              <th className="text-left px-4 py-2">Alertas</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {fichas.map((f) => {
              const alertas = [
                ...f.alertas.map((a) => a.alvo.nome),
                ...f.alvos.map((a) => a.origem.nome),
              ];
              return (
                <tr key={f.id}>
                  <td className="px-4 py-2">{f.numero}</td>
                  <td className="px-4 py-2">{f.nucleo}</td>
                  <td className="px-4 py-2">{f.nome}</td>
                  <td className="px-4 py-2">{f.situacao}</td>
                  <td className="px-4 py-2">{f.tribo?.nome || "—"}</td>
                  <td className="px-4 py-2 text-xs text-[var(--brass)]">{alertas.join(", ") || "—"}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <VerEditarFichaButton ficha={f} />
                    <form action={excluirFicha} className="inline">
                      <input type="hidden" name="id" value={f.id} />
                      <button className="btn-danger-link">Excluir</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {fichas.length === 0 && <p className="p-4 text-[var(--ink-soft)]/60">Nenhuma ficha cadastrada.</p>}
      </div>

      <h2 className="font-bold mb-3">Adicionar alerta de parentesco/amizade</h2>
      <form action={adicionarAlerta} className="card p-4 flex gap-3 items-end mb-6">
        <label className="text-sm flex-1">
          Ficha
          <select name="origemId" required className="w-full input mt-1">
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.numero} — {f.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm flex-1">
          Não pode ficar na mesma tribo que
          <select name="alvoId" required className="w-full input mt-1">
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.numero} — {f.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary px-4 py-2 text-sm">Adicionar</button>
      </form>

      <div className="card overflow-hidden">
        <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 text-sm font-medium">Alertas cadastrados</div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[var(--line)]">
            {fichas.flatMap((f) =>
              f.alertas.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2">
                    {f.numero} — {f.nome}
                  </td>
                  <td className="px-4 py-2">↔</td>
                  <td className="px-4 py-2">
                    {a.alvo.numero} — {a.alvo.nome}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={removerAlerta}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn-danger-link">Remover</button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
