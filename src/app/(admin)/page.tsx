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

  const [servos, fichas, comCerco, pagos] = await Promise.all([
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO" } }),
    db.neocampista.count({ where: { missaoId: missao.id } }),
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO", cercoHorario: { not: null } } }),
    db.servo.count({ where: { missaoId: missao.id, status: "ATIVO", pago: true } }),
  ]);
  const horariosOcupados = await db.servo.groupBy({
    by: ["cercoHorario"],
    where: { missaoId: missao.id, cercoHorario: { not: null } },
  });
  const setOcupados = new Set(horariosOcupados.map((h) => h.cercoHorario));
  const buracos = HORARIOS_CERCO.filter((h) => !setOcupados.has(h)).length;

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
    </div>
  );
}
