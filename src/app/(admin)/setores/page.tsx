import Link from "next/link";
import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SetoresPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const grupos = await db.servo.groupBy({
    by: ["setor"],
    where: { missaoId: missao.id, status: "ATIVO" },
    _count: true,
    orderBy: { setor: "asc" },
  });

  const total = grupos.reduce((a, g) => a + g._count, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Servos por Setor</h1>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--ink)] text-[var(--paper)]">
            <tr>
              <th className="text-left px-4 py-2">Setor</th>
              <th className="text-left px-4 py-2">Qtd. servos</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {grupos.map((g) => (
              <tr key={g.setor}>
                <td className="px-4 py-2">{g.setor}</td>
                <td className="px-4 py-2">{g._count}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/servos?setor=${encodeURIComponent(g.setor)}`} className="btn-link">
                    Ver lista
                  </Link>
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--paper)] font-bold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2">{total}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
