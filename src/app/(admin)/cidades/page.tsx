import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function CidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ cidade?: string }>;
}) {
  const { cidade } = await searchParams;
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const servos = await db.servo.findMany({
    where: { missaoId: missao.id, status: "ATIVO" },
    include: { pessoa: true },
  });

  const grupos = new Map<string, typeof servos>();
  for (const s of servos) {
    const c = s.pessoa.cidade || "SEM CIDADE";
    if (!grupos.has(c)) grupos.set(c, []);
    grupos.get(c)!.push(s);
  }
  const ordenado = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Servos por Cidade</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {ordenado.map(([nomeCidade, lista]) => (
          <div key={nomeCidade} className="card overflow-hidden">
            <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 text-sm font-medium">
              {nomeCidade} ({lista.length})
            </div>
            <ul className="divide-y divide-[var(--line)] text-sm">
              {lista.map((s) => (
                <li key={s.id} className="px-4 py-2 flex justify-between">
                  <span>{s.pessoa.nome}</span>
                  <span className="text-[var(--ink-soft)]/60">{s.setor}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {ordenado.length === 0 && <p className="text-[var(--ink-soft)]/60">Nenhum servo encontrado.</p>}
    </div>
  );
}
