import { db } from "@/lib/db";
import { criarMissao, selecionarMissao } from "@/lib/actions";
import { TIPOS_MISSAO } from "@/lib/constants";
import { requireRole } from "@/lib/auth";
import ExcluirMissaoButton from "./ExcluirMissaoButton";

export default async function MissoesPage() {
  await requireRole("SUPER");
  const missoes = await db.missao.findMany({
    orderBy: { id: "desc" },
    include: { _count: { select: { servos: true, neocampistas: true } } },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Missões</h1>

      <div className="card divide-y divide-[var(--line)] mb-8">
        {missoes.map((m) => (
          <div key={m.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{m.nome}</div>
              <div className="text-sm text-[var(--ink-soft)]/60">
                {m.tipo} · {m.ano} · {m._count.servos} servos · {m._count.neocampistas} neocampistas ·
                cerco: /cerco/{m.cercoSlug}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <form action={selecionarMissao}>
                <input type="hidden" name="id" value={m.id} />
                <button className="text-sm btn-primary px-3 py-1">Ativar</button>
              </form>
              <ExcluirMissaoButton id={m.id} nome={m.nome} />
            </div>
          </div>
        ))}
        {missoes.length === 0 && <p className="p-4 text-[var(--ink-soft)]/60">Nenhuma missão cadastrada.</p>}
      </div>

      <h2 className="font-bold mb-3">Nova missão</h2>
      <form action={criarMissao} className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="nome" required placeholder="Nome (ex: 22° Acampamento Sênior)" className="input col-span-2" />
        <select name="tipo" className="input">
          {TIPOS_MISSAO.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input name="ano" type="number" required placeholder="Ano" className="input" />
        <input name="cercoSlug" required placeholder="Slug do cerco (ex: cercosenior22)" className="input col-span-2" />
        <input name="valorInterna" type="number" step="0.01" placeholder="Valor eq. interna (160)" className="input" />
        <input name="valorExterna" type="number" step="0.01" placeholder="Valor eq. externa (80)" className="input" />
        <input name="valorCampista" type="number" step="0.01" placeholder="Valor campista (300)" className="input" />
        <button className="btn-primary px-4 py-2 col-span-2">Criar missão</button>
      </form>
    </div>
  );
}
