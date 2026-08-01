import Link from "next/link";
import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { HORARIOS_CERCO } from "@/lib/constants";

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

  const cards = [
    ["Servos ativos", servos, "/servos"],
    ["Neocampistas", fichas, "/fichas"],
    ["Servos no Cerco", `${comCerco}/${servos}`, "/cerco-dashboard"],
    ["Horários vazios no Cerco", buracos, "/cerco-dashboard"],
    ["Servos que pagaram", `${pagos}/${servos}`, "/financeiro"],
  ] as const;

  return (
    <div>
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-1">{missao.nome}</h1>
      <p className="text-[var(--ink-soft)]/60 mb-6">
        Link público do Cerco:{" "}
        <Link className="btn-link" href={`/cerco/${missao.cercoSlug}`}>
          /cerco/{missao.cercoSlug}
        </Link>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(([label, value, href]) => (
          <Link key={label} href={href} className="stat-card hover:shadow-md transition-shadow">
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </Link>
        ))}
      </div>

      <div className="stat-card mt-4">
        <div className="stat-value">{semHorario.length}</div>
        <div className="stat-label">Servos sem horário no Cerco</div>
        {semHorario.length > 0 && (
          <ul className="mt-3 max-h-40 overflow-y-auto text-sm text-[var(--ink-soft)]/80 space-y-1">
            {semHorario.map((s) => (
              <li key={s.id}>
                {s.pessoa.nome} <span className="text-[var(--ink-soft)]/50">— {s.setor}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {horariosCriticos.length > 0 && (
        <div className="stat-card mt-4 border-l-4 border-[var(--signal)] bg-[var(--signal)]/5">
          <div className="stat-value text-[var(--signal)]">{horariosCriticos.length}</div>
          <div className="stat-label">Horários com 2 ou menos pessoas no Cerco</div>
          <ul className="mt-3 max-h-40 overflow-y-auto text-sm text-[var(--ink-soft)]/80 space-y-1">
            {horariosCriticos.map((h) => (
              <li key={h.horario}>
                {h.horario} <span className="text-[var(--ink-soft)]/50">— {h.qtd} pessoa(s)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
