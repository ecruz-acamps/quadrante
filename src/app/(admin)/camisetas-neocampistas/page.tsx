import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAMISETAS, COR_TRIBO_HEX } from "@/lib/constants";

// Camisetas dos neocampistas, separadas por tribo: cada um com o tamanho ao lado, a contagem por tamanho de cada
// tribo e o total geral (para o pedido). Quem ainda não tem tribo aparece em "SEM TRIBO", no fim.
type Campista = { id: number; numero: number; nome: string; camiseta: string | null };

const SEM_TAMANHO = "sem tamanho";

function contagem(campistas: Campista[]) {
  const mapa = new Map<string, number>();
  for (const c of campistas) {
    const t = c.camiseta || SEM_TAMANHO;
    mapa.set(t, (mapa.get(t) ?? 0) + 1);
  }
  // tamanhos na ordem do sistema; outros (digitados à mão) depois; "sem tamanho" no fim
  const ordem = [...CAMISETAS, ...[...mapa.keys()].filter((t) => !CAMISETAS.includes(t) && t !== SEM_TAMANHO).sort(), SEM_TAMANHO];
  return ordem.filter((t) => mapa.has(t)).map((t) => ({ tamanho: t, qtd: mapa.get(t)! }));
}

function Tamanhos({ campistas }: { campistas: Campista[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {contagem(campistas).map(({ tamanho, qtd }) => (
        <span
          key={tamanho}
          className={`rounded-full px-2 py-0.5 text-xs border ${
            tamanho === SEM_TAMANHO
              ? "bg-[var(--signal-soft)] text-[var(--signal)] border-[var(--signal)]/30"
              : "bg-[#eef1f8] text-[var(--ink)] border-[var(--line)]"
          }`}
        >
          <strong>{tamanho}</strong>: {qtd}
        </span>
      ))}
    </div>
  );
}

function QuadroTribo({ nome, cor, campistas }: { nome: string; cor: string; campistas: Campista[] }) {
  const ordenados = [...campistas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <div className="table-shell">
      <div className="qd-card-head flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ background: cor }} aria-hidden />
          {nome}
        </span>
        <span className="rounded-full bg-[#eef1f8] px-2.5 py-0.5 font-[var(--font-plex-mono)] text-xs font-medium text-[var(--ink)]">
          {campistas.length} {campistas.length === 1 ? "campista" : "campistas"}
        </span>
      </div>
      <div className="px-4 py-2 border-b border-[var(--line)]">
        <Tamanhos campistas={campistas} />
      </div>
      <table className="w-full text-sm">
        <thead className="qd-thead">
          <tr>
            <th className="text-left px-4 py-1.5 w-12">Nº</th>
            <th className="text-left px-4 py-1.5">Nome</th>
            <th className="text-left px-4 py-1.5 w-28">Camiseta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {ordenados.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-1.5 text-[var(--ink-soft)]/70 font-mono">{c.numero}</td>
              <td className="px-4 py-1.5">{c.nome}</td>
              <td className="px-4 py-1.5">
                {c.camiseta ? (
                  <span className="inline-block min-w-8 rounded border border-[var(--line)] px-2 py-0.5 text-center font-semibold">{c.camiseta}</span>
                ) : (
                  <span className="text-xs text-[var(--signal)]">{SEM_TAMANHO}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CamisetasNeocampistasPage() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const [tribos, semTribo] = await Promise.all([
    db.tribo.findMany({
      where: { missaoId: missao.id },
      orderBy: { nome: "asc" },
      include: { neocampistas: { select: { id: true, numero: true, nome: true, camiseta: true } } },
    }),
    db.neocampista.findMany({
      where: { missaoId: missao.id, triboId: null },
      select: { id: true, numero: true, nome: true, camiseta: true },
    }),
  ]);
  const comCampistas = tribos.filter((t) => t.neocampistas.length > 0);
  const todos = [...comCampistas.flatMap((t) => t.neocampistas), ...semTribo];

  return (
    <div>
      <h1 className="page-title mb-2">Camisetas dos Neocampistas</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-4">Por tribo, com o tamanho de cada um. O tamanho vem da ficha (Fichas › Ver/Editar).</p>

      {todos.length === 0 ? (
        <p className="text-[var(--ink-soft)]/70">Nenhuma ficha cadastrada nesta missão.</p>
      ) : (
        <>
          <div className="card p-4 mb-6">
            <p className="text-sm font-medium text-[var(--ink)] mb-2">
              Total ({todos.length} {todos.length === 1 ? "neocampista" : "neocampistas"})
            </p>
            <Tamanhos campistas={todos} />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {comCampistas.map((t) => (
              <QuadroTribo key={t.id} nome={t.nome} cor={COR_TRIBO_HEX[t.nome] || "var(--brass)"} campistas={t.neocampistas} />
            ))}
            {semTribo.length > 0 && <QuadroTribo nome="SEM TRIBO" cor="#9aa3b2" campistas={semTribo} />}
          </div>
        </>
      )}
    </div>
  );
}
