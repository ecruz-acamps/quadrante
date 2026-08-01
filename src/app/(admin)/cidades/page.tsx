import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import CidadeCard from "./CidadeCard";

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
          <CidadeCard key={nomeCidade} nomeCidade={nomeCidade} servos={lista} />
        ))}
      </div>
      {ordenado.length === 0 && <p className="text-[var(--ink-soft)]/60">Nenhum servo encontrado.</p>}
    </div>
  );
}
