import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const termo = (q || "").trim();

  const pessoas = await db.pessoa.findMany({
    where: termo ? { nome: { contains: termo } } : undefined,
    select: {
      id: true,
      nome: true,
      cidade: true,
      _count: { select: { servos: true } },
    },
    orderBy: termo ? { nome: "asc" } : { servos: { _count: "desc" } },
    take: termo ? 200 : 30,
  });

  return (
    <div>
      <h1 className="page-title mb-2">Pessoas</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-6">
        Busca em todas as missões. Sem busca, mostra os servos com mais participações.
      </p>

      <form className="flex flex-wrap gap-3 mb-6">
        <input name="q" defaultValue={termo} placeholder="Buscar por nome" className="input text-sm w-full sm:w-72" />
        <button className="btn-primary px-4 py-2 text-sm">Buscar</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="qd-thead">
            <tr>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">Cidade</th>
              <th className="text-right px-4 py-2">Missões</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {pessoas.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">{p.nome}</td>
                <td className="px-4 py-2">{p.cidade || "—"}</td>
                <td className="px-4 py-2 text-right font-[var(--font-plex-mono)]">{p._count.servos}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/pessoas/${p.id}`} className="btn-link">
                    Ficha
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {pessoas.length === 0 && (
          <p className="text-[var(--ink-soft)]/60 p-4">Ninguém encontrado com esse nome.</p>
        )}
      </div>
    </div>
  );
}
