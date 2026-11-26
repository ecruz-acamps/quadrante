import Link from "next/link";
import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HORARIOS_CERCO } from "@/lib/constants";
import { resumoNucleos } from "@/lib/controleNucleos";
import { IconUsers, IconClipboard, IconClock, IconAlert, IconCoin } from "./DashboardIcons";

export default async function Home() {
  const usuario = await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) {
    return (
      <div>
        <h1 className="page-title mb-4">Bem-vindo ao Quadrante</h1>
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

  const oneDriveConectado = Boolean(await db.integracaoOneDrive.findUnique({ where: { id: 1 }, select: { id: true } }));
  const [servos, disseramSim, recusaram, desistiram, fichas, comCerco, pagos] = await Promise.all([
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO" } }),
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO", confirmado: true } }),
    db.servo.count({ where: { missaoId: missao.id, status: "RECUSOU" } }),
    db.servo.count({ where: { missaoId: missao.id, status: "DESISTIU" } }),
    db.neocampista.count({ where: { missaoId: missao.id } }),
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } } }),
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO", pago: true } }),
  ]);
  // fichas que faltam por núcleo (o que cada núcleo recebeu é digitado em Fichas › Controle por núcleo)
  const [recebidasNucleos, fichasPorNucleo] = await Promise.all([
    db.nucleoFichas.findMany({ where: { missaoId: missao.id } }),
    db.neocampista.groupBy({ by: ["nucleo"], where: { missaoId: missao.id }, _count: true }),
  ]);
  const nucleos = resumoNucleos(
    new Map(recebidasNucleos.map((r) => [r.nucleo, r.recebidas])),
    new Map(fichasPorNucleo.map((c) => [c.nucleo, c._count])),
  );
  const nucleosPendentes = nucleos.linhas.filter((l) => l.faltam > 0 || l.aMais > 0);

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
      label: "Servos que disseram sim",
      value: disseramSim,
      href: "/servos",
      icon: IconUsers,
      color: "var(--ink)",
      soft: "color-mix(in srgb, var(--ink) 10%, var(--card))",
    },
    {
      label: "Disseram não",
      value: recusaram,
      href: "/registros",
      icon: IconAlert,
      color: "var(--signal)",
      soft: "var(--signal-soft)",
    },
    {
      label: "Desistiram",
      value: desistiram,
      href: "/registros",
      icon: IconAlert,
      color: "var(--signal)",
      soft: "var(--signal-soft)",
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="page-title">{missao.nome}</h1>
        {oneDriveConectado ? (
          // abre numa aba nova a pasta da missão no OneDrive (fichas, tribos)
          <a href="/pasta-missao" target="_blank" rel="noreferrer" className="btn-primary px-4 py-2 text-sm">
            Abrir pasta da missão
          </a>
        ) : (
          <span className="text-xs text-[var(--ink-soft)]/70">
            Pasta da missão: OneDrive não conectado
            {usuario.role === "SUPER" && (
              <>
                {" "}
                (
                <Link className="btn-link" href="/configuracoes#onedrive">
                  conectar
                </Link>
                )
              </>
            )}
          </span>
        )}
      </div>
      <p className="text-[var(--ink-soft)]/60 mb-6">
        Link público do Cerco:{" "}
        <Link className="btn-link" href={`/cerco/${missao.cercoSlug}`}>
          /cerco/{missao.cercoSlug}
        </Link>
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 sm:gap-4">
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

      {/* quadros compactos: uma linha de título e etiquetas pequenas */}
      <div className="card mt-6 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <IconClipboard className="w-4 h-4 text-[var(--brass)] shrink-0" />
          <span className="text-sm font-medium text-[var(--ink)]">
            {nucleos.total.recebidas > 0 ? (
              <>
                Fichas que faltam chegar: <strong>{nucleos.total.faltam}</strong>
                <span className="font-normal text-[var(--ink-soft)]/70">
                  {" "}
                  ({nucleos.total.cadastradas} de {nucleos.total.recebidas} cadastradas)
                </span>
              </>
            ) : (
              "Fichas por núcleo: informe quantas cada núcleo recebeu"
            )}
          </span>
          <Link className="btn-link text-xs ml-auto" href="/fichas/nucleos">
            Controle por núcleo →
          </Link>
        </div>
        {nucleos.total.recebidas > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {nucleosPendentes.length === 0 ? (
              <span className="text-xs text-green-700">Todos os núcleos completos.</span>
            ) : (
              nucleosPendentes.map((l) =>
                l.aMais > 0 ? (
                  <span
                    key={l.nucleo}
                    title="Mais fichas cadastradas do que recebidas"
                    className="text-xs rounded-full px-2 py-0.5 border border-[var(--signal)]/30 bg-[var(--signal-soft)] text-[var(--signal)]"
                  >
                    {l.nucleo} · +{l.aMais}
                  </span>
                ) : (
                  <span
                    key={l.nucleo}
                    title={`faltam ${l.faltam} de ${l.recebidas}`}
                    className="text-xs rounded-full px-2 py-0.5 border border-[var(--line)] bg-[var(--paper)] text-[var(--ink-soft)]"
                  >
                    {l.nucleo} · <strong className="text-[var(--ink)]">{l.faltam}</strong>
                  </span>
                ),
              )
            )}
          </div>
        )}
      </div>

      {horariosCriticos.length > 0 && (
        <div className="card mt-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="shrink-0" style={{ color: "var(--amber)" }}><IconClock className="w-4 h-4" /></span>
            <span className="text-sm font-medium text-[var(--ink)]">
              <strong style={{ color: "var(--amber)" }}>{horariosCriticos.length}</strong>{" "}
              {horariosCriticos.length === 1 ? "horário" : "horários"} com 2 ou menos pessoas no Cerco
            </span>
            <Link className="btn-link text-xs ml-auto" href="/cerco-dashboard">
              Cerco de Jericó →
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {horariosCriticos.map((h) => (
              <span
                key={h.horario}
                className="text-xs rounded-full px-2 py-0.5 border border-[var(--amber)]/25 bg-[var(--amber-soft)] text-[var(--ink-soft)]"
              >
                {h.horario.replace(" - ", "–")} · <strong style={{ color: "var(--amber)" }}>{h.qtd}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
