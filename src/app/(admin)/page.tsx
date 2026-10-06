import Link from "next/link";
import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { HORARIOS_CERCO } from "@/lib/constants";
import { IconUsers, IconClipboard, IconClock, IconAlert, IconCoin } from "./DashboardIcons";

export default async function Home() {
  const missao = await getMissaoAtiva();
  if (!missao) {
    return (
      <div>
        <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-4">Bem-vindo ao Quadrante</h1>
        <p>
          Nenhuma missão cadastrada ainda.{" "}
          <Link className="btn-link" href="/missoes">
            Crie a primeira missão
          </Link>
          .
        </p>
      </div>
    );
  }

  const [servos, fichas, comCerco, pagos, semHorario] = await Promise.all([
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO" } }),
    db.neocampista.count({ where: { missaoId: missao.id } }),
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } } }),
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO", pago: true } }),
    db.servo.findMany({
      where: { missaoId: missao.id, status: "ATIVO", cercoHorario: null },
      include: { pessoa: true },
      orderBy: { pessoa: { nome: "asc" } },
    }),
  ]);
  const horariosOcupados = await db.servo.groupBy({
    by: ["cercoHorario"],
    where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } },
    _count: true,
  });
  const contagemPorHorario = new Map(horariosOcupados.map((h) => [h.cercoHorario, h._count]));
  const buracos = HORARIOS_CERCO.filter((h) => !contagemPorHorario.has(h)).length;
  const horariosCriticos = HORARIOS_CERCO.map((h) => ({ horario: h, qtd: contagemPorHorario.get(h) ?? 0 })).filter(
    (h) => h.qtd <= 2,
  );

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

  const kpis = [
    {
      label: "Servos ativos",
      value: servos,
      href: "/servos",
      icon: IconUsers,
      color: "var(--ink)",
      soft: "color-mix(in srgb, var(--ink) 10%, var(--card))",
    },
    {
      label: "Neocampistas inscritos",
      value: fichas,
      href: "/fichas",
      icon: IconClipboard,
      color: "var(--brass)",
      soft: "var(--amber-soft)",
    },
    {
      label: "Escalados no Cerco",
      value: `${comCerco}/${servos}`,
      href: "/cerco-dashboard",
      icon: IconClock,
      color: "var(--purple)",
      soft: "var(--purple-soft)",
      pct: pct(comCerco, servos),
      barColor: "var(--purple)",
    },
    {
      label: "Horários vagos no Cerco",
      value: buracos,
      href: "/cerco-dashboard",
      icon: IconAlert,
      color: "var(--signal)",
      soft: "var(--signal-soft)",
    },
    {
      label: "Servos que pagaram",
      value: `${pagos}/${servos}`,
      href: "/financeiro",
      icon: IconCoin,
      color: "var(--success)",
      soft: "var(--success-soft)",
      pct: pct(pagos, servos),
      barColor: "var(--success)",
    },
  ];

  return (
    <div>
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-1">{missao.nome}</h1>
      <p className="text-[var(--ink-soft)]/60 mb-6">
        Link público do Cerco:{" "}
        <Link className="btn-link" href={`/cerco/${missao.cercoSlug}`}>
          /cerco/{missao.cercoSlug}
        </Link>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link
              key={k.label}
              href={k.href}
              className="kpi-card hover:-translate-y-0.5 hover:shadow-lg transition-all flex flex-col gap-3"
            >
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
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${Math.min(k.pct, 100)}%`, background: k.barColor }}
                  />
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {semHorario.length > 0 && (
        <div className="kpi-card mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="kpi-icon" style={{ background: "var(--signal-soft)", color: "var(--signal)" }}>
              <IconAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="kpi-value text-2xl">{semHorario.length}</div>
              <div className="kpi-label">Servos sem horário no Cerco</div>
            </div>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {semHorario.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-sm bg-[var(--signal-soft)] border border-[var(--signal)]/15 rounded-lg px-3 py-2"
              >
                <span className="truncate">
                  <span className="font-medium text-[var(--ink-soft)]">{s.pessoa.nome}</span>{" "}
                  <span className="text-[var(--ink-soft)]/50">— {s.setor}</span>
                </span>
                <span className="shrink-0 text-[0.65rem] uppercase tracking-wide font-semibold text-[var(--signal)]">
                  pendente
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {horariosCriticos.length > 0 && (
        <div className="kpi-card mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="kpi-icon" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
              <IconClock className="w-5 h-5" />
            </div>
            <div>
              <div className="kpi-value text-2xl" style={{ color: "var(--amber)" }}>
                {horariosCriticos.length}
              </div>
              <div className="kpi-label">Horários com 2 ou menos pessoas no Cerco</div>
            </div>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {horariosCriticos.map((h) => (
              <li
                key={h.horario}
                className="flex items-center justify-between gap-2 text-sm bg-[var(--amber-soft)] border border-[var(--amber)]/20 rounded-lg px-3 py-2"
              >
                <span className="font-medium text-[var(--ink-soft)]">{h.horario}</span>
                <span className="text-[var(--amber)] font-semibold">{h.qtd} pessoa(s)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
