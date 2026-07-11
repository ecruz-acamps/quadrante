import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAMISETAS } from "@/lib/constants";

export default async function CamisetasPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const [servos, fichas] = await Promise.all([
    db.servo.groupBy({
      by: ["camiseta"],
      where: { missaoId: missao.id, status: "ATIVO" },
      _count: true,
    }),
    db.neocampista.groupBy({
      by: ["camiseta"],
      where: { missaoId: missao.id },
      _count: true,
    }),
  ]);

  const mapServos = new Map(servos.map((s) => [s.camiseta || "—", s._count]));
  const mapFichas = new Map(fichas.map((f) => [f.camiseta || "—", f._count]));

  const totalServos = servos.reduce((a, s) => a + s._count, 0);
  const totalFichas = fichas.reduce((a, f) => a + f._count, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Camisetas</h1>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--ink)] text-[var(--paper)]">
            <tr>
              <th className="text-left px-4 py-2">Tamanho</th>
              <th className="text-left px-4 py-2">Servos</th>
              <th className="text-left px-4 py-2">Neocampistas (campistas)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {CAMISETAS.map((c) => (
              <tr key={c}>
                <td className="px-4 py-2 font-medium">{c}</td>
                <td className="px-4 py-2">{mapServos.get(c) || 0}</td>
                <td className="px-4 py-2">{mapFichas.get(c) || 0}</td>
              </tr>
            ))}
            <tr className="bg-[var(--paper)] font-bold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2">{totalServos}</td>
              <td className="px-4 py-2">{totalFichas}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
