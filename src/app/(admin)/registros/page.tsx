import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function RegistrosPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const [recusaram, desistiram, faltaram] = await Promise.all([
    db.servo.findMany({ where: { missaoId: missao.id, status: "RECUSOU" }, include: { pessoa: true } }),
    db.servo.findMany({ where: { missaoId: missao.id, status: "DESISTIU" }, include: { pessoa: true } }),
    db.servo.findMany({
      where: {
        missaoId: missao.id,
        status: "ATIVO",
        OR: [{ formacao1: "Não" }, { formacao2: "Não" }, { formacao3: "Não" }],
      },
      include: { pessoa: true },
    }),
  ]);

  const Table = ({ titulo, lista, mostrarMotivo }: { titulo: string; lista: typeof recusaram; mostrarMotivo?: boolean }) => (
    <div className="card overflow-hidden mb-6">
      <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 text-sm font-medium">
        {titulo} ({lista.length})
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--paper)] text-[var(--ink-soft)]/60">
          <tr>
            <th className="text-left px-4 py-2">Nome</th>
            <th className="text-left px-4 py-2">Setor</th>
            <th className="text-left px-4 py-2">Celular</th>
            {mostrarMotivo && <th className="text-left px-4 py-2">Motivo / Formações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {lista.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2">{s.pessoa.nome}</td>
              <td className="px-4 py-2">{s.setor}</td>
              <td className="px-4 py-2">{s.pessoa.celular || "—"}</td>
              {mostrarMotivo && (
                <td className="px-4 py-2 text-xs">
                  {s.motivoFalta || `F1:${s.formacao1 || "-"} F2:${s.formacao2 || "-"} F3:${s.formacao3 || "-"}`}
                </td>
              )}
            </tr>
          ))}
          {lista.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-2 text-[var(--ink-soft)]/40">
                Nenhum registro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Não / Desistências / Faltas na formação</h1>
      <Table titulo="Falaram NÃO ao chamado" lista={recusaram} />
      <Table titulo="Desistiram" lista={desistiram} />
      <Table titulo="Faltaram na formação" lista={faltaram} mostrarMotivo />
    </div>
  );
}
