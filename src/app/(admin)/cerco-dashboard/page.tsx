import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { HORARIOS_CERCO } from "@/lib/constants";
import Link from "next/link";

export default async function CercoDashboardPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const servos = await db.servo.findMany({
    where: { missaoId: missao.id, status: "ATIVO" },
    include: { pessoa: true },
  });

  const porHorario = new Map<string, typeof servos>();
  for (const h of HORARIOS_CERCO) porHorario.set(h, []);
  let semHorario = 0;
  for (const s of servos) {
    if (!s.cercoHorario) {
      semHorario++;
      continue;
    }
    porHorario.get(s.cercoHorario)?.push(s);
  }

  const porSetor = new Map<string, number>();
  for (const s of servos) {
    if (!s.cercoHorario) continue;
    porSetor.set(s.setor, (porSetor.get(s.setor) || 0) + 1);
  }

  const buracos = HORARIOS_CERCO.filter((h) => (porHorario.get(h)?.length || 0) === 0);
  const totalInscritos = servos.length - semHorario;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)]">Dashboard — Cerco de Jericó</h1>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/cerco-dashboard/exportar" className="text-sm btn-link">
            Exportar grade 24h (Excel)
          </a>
          <Link href={`/cerco/${missao.cercoSlug}`} target="_blank" className="text-sm btn-link">
            Abrir link público
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{totalInscritos}</div>
          <div className="stat-label">Inscritos no Cerco</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{semHorario}</div>
          <div className="stat-label">Servos sem horário</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{buracos.length}</div>
          <div className="stat-label">Horários vazios (24h)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{HORARIOS_CERCO.length - buracos.length}/24</div>
          <div className="stat-label">Horários cobertos</div>
        </div>
      </div>

      {buracos.length > 0 && (
        <div className="bg-[var(--signal)]/10 border border-[var(--signal)]/30 rounded-lg p-4 mb-6 text-sm text-[var(--signal)]">
          <strong>Horários sem ninguém: </strong>
          {buracos.join(", ")}
        </div>
      )}

      <div className="mb-6">
        <div className="card overflow-hidden">
          <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 text-sm font-medium">Servos por Setor no Cerco</div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--line)]">
              {[...porSetor.entries()].sort((a, b) => b[1] - a[1]).map(([setor, qtd]) => (
                <tr key={setor}>
                  <td className="px-4 py-2">{setor}</td>
                  <td className="px-4 py-2">{qtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 text-sm font-medium">Grade 24 horas</div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper)] text-[var(--ink-soft)]/60">
            <tr>
              <th className="text-left px-4 py-2">Horário</th>
              <th className="text-left px-4 py-2">Qtd.</th>
              <th className="text-left px-4 py-2">Servos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {HORARIOS_CERCO.map((h) => {
              const lista = porHorario.get(h) || [];
              return (
                <tr key={h} className={lista.length === 0 ? "bg-[var(--signal)]/5" : ""}>
                  <td className="px-4 py-2 font-medium">{h}</td>
                  <td className="px-4 py-2">{lista.length}</td>
                  <td className="px-4 py-2">{lista.map((s) => s.pessoa.nome).join(", ") || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
