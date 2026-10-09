import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HORARIOS_CERCO } from "@/lib/constants";
import Link from "next/link";
import { IconClipboard, IconAlert, IconClock, IconCheck } from "../DashboardIcons";

const MINIMO_POR_HORARIO = 2;

export default async function CercoDashboardPage() {
  await requireUser();
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
  const cobertos = HORARIOS_CERCO.length - buracos.length;
  const totalInscritos = servos.length - semHorario;

  const kpis = [
    {
      label: "Inscritos no Cerco",
      value: totalInscritos,
      icon: IconClipboard,
      color: "var(--ink)",
      soft: "color-mix(in srgb, var(--ink) 10%, var(--card))",
    },
    {
      label: "Servos sem horário",
      value: semHorario,
      icon: IconAlert,
      color: "var(--signal)",
      soft: "var(--signal-soft)",
    },
    {
      label: "Horários vazios (24h)",
      value: buracos.length,
      icon: IconAlert,
      color: "var(--amber)",
      soft: "var(--amber-soft)",
    },
    {
      label: "Horários cobertos",
      value: `${cobertos}/24`,
      icon: IconCheck,
      color: "var(--success)",
      soft: "var(--success-soft)",
      pct: Math.round((cobertos / 24) * 100),
      barColor: "var(--success)",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="page-title">Dashboard — Cerco de Jericó</h1>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/cerco-dashboard/exportar" className="text-sm btn-link">
            Exportar grade 24h (Excel)
          </a>
          <Link href={`/cerco/${missao.cercoSlug}`} target="_blank" className="text-sm btn-link">
            Abrir link público
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="kpi-card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="kpi-icon" style={{ background: k.soft, color: k.color }}>
                  <Icon className="w-5 h-5" />
                </div>
                {k.pct !== undefined && (
                  <span className="text-xs font-semibold" style={{ color: k.color }}>
                    {k.pct}%
                  </span>
                )}
              </div>
              <div>
                <div className="kpi-value">{k.value}</div>
                <div className="kpi-label">{k.label}</div>
              </div>
              {k.pct !== undefined && (
                <div className="kpi-bar-track">
                  <div className="kpi-bar-fill" style={{ width: `${Math.min(k.pct, 100)}%`, background: k.barColor }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-6">
        <div className="card overflow-hidden">
          <div className="qd-card-head">Servos por Setor no Cerco</div>
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

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-[var(--font-spectral)] text-lg text-[var(--ink)]">Grade 24 horas</h2>
          <div className="flex items-center gap-4 text-xs text-[var(--ink-soft)]/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--success)" }} /> completo (≥ {MINIMO_POR_HORARIO})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--signal)" }} /> incompleto
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-[var(--line)]" style={{ background: "var(--paper)" }} /> vazio
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {HORARIOS_CERCO.map((h) => {
            const lista = porHorario.get(h) || [];
            const vazio = lista.length === 0;
            const completo = lista.length >= MINIMO_POR_HORARIO;
            const bg = vazio ? "var(--card)" : completo ? "var(--success-soft)" : "var(--signal-soft)";
            const border = vazio ? "var(--line)" : completo ? "color-mix(in srgb, var(--success) 35%, transparent)" : "color-mix(in srgb, var(--signal) 35%, transparent)";
            const dot = vazio ? "var(--line)" : completo ? "var(--success)" : "var(--signal)";
            const valueColor = vazio ? "var(--ink-soft)" : completo ? "var(--success)" : "var(--signal)";
            return (
              <div
                key={h}
                className="horario-card flex flex-col gap-2"
                style={{ background: bg, borderColor: border }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--ink-soft)]/70">{h}</span>
                  <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
                </div>
                <div className="text-xl font-bold" style={{ fontFamily: "var(--font-plex-mono), monospace", color: valueColor }}>
                  {lista.length}
                </div>
                <div className="text-[0.7rem] text-[var(--ink-soft)]/60 leading-snug line-clamp-2 min-h-[2.1em]">
                  {lista.map((s) => s.pessoa.nome).join(", ") || "Ninguém escalado"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
