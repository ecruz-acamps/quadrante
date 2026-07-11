import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ordenarPorEdicao } from "@/lib/missoes";

// paleta validada (dataviz: lightness/chroma/CVD/contraste OK sobre --card)
const COR_SERVOS = "#3155A6";
const COR_CAMPISTAS = "#A67C22";

export default async function EstatisticasPage() {
  await requireRole("SUPER");

  const missoes = await db.missao.findMany({
    include: { _count: { select: { servos: true, neocampistas: true } } },
  });
  const comDados = ordenarPorEdicao(
    missoes.filter((m) => m._count.servos > 0 || m._count.neocampistas > 0)
  );

  const totalPessoas = await db.pessoa.count();
  const totalParticipacoes = await db.servo.count();
  const veteranos = await db.$queryRawUnsafe<{ c: bigint }[]>(
    "SELECT COUNT(*) c FROM (SELECT pessoaId FROM Servo GROUP BY pessoaId HAVING COUNT(*) >= 2)"
  );

  // gráfico de barras horizontais agrupadas (SVG server-rendered)
  const max = Math.max(...comDados.map((m) => Math.max(m._count.servos, m._count.neocampistas)));
  const nomeW = 190;
  const valorW = 40;
  const plotW = 480;
  const barH = 11;
  const grupoH = barH * 2 + 2 + 10; // 2 barras + gap 2px + respiro
  const topo = 8;
  const altura = topo + comDados.length * grupoH + 8;
  const largura = nomeW + plotW + valorW;
  const w = (v: number) => Math.max((v / max) * plotW, v > 0 ? 2 : 0);

  return (
    <div>
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-2">Estatísticas</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-6">
        Servos e campistas por edição, em todas as missões registradas.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-value">{comDados.length}</div>
          <div className="stat-label">Missões</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalPessoas}</div>
          <div className="stat-label">Pessoas cadastradas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalParticipacoes}</div>
          <div className="stat-label">Participações de servos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Number(veteranos[0]?.c ?? 0)}</div>
          <div className="stat-label">Serviram 2+ missões</div>
        </div>
      </div>

      <div className="card p-4 overflow-x-auto">
        <div className="flex items-center gap-5 mb-3 text-xs text-[var(--ink-soft)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COR_SERVOS }} />
            Servos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COR_CAMPISTAS }} />
            Campistas
          </span>
        </div>
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          width={largura}
          height={altura}
          role="img"
          aria-label="Servos e campistas por edição"
          className="max-w-full h-auto"
        >
          {comDados.map((m, i) => {
            const y = topo + i * grupoH;
            return (
              <g key={m.id}>
                <text
                  x={nomeW - 8}
                  y={y + barH + 2}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--ink-soft)"
                >
                  {m.nome.length > 26 ? m.nome.slice(0, 25) + "…" : m.nome}
                </text>
                <rect x={nomeW} y={y} width={w(m._count.servos)} height={barH} rx="2" fill={COR_SERVOS}>
                  <title>{`${m.nome} — ${m._count.servos} servos`}</title>
                </rect>
                <text
                  x={nomeW + w(m._count.servos) + 5}
                  y={y + barH - 2}
                  fontSize="10"
                  fill="var(--ink-soft)"
                  fontFamily="var(--font-plex-mono)"
                >
                  {m._count.servos}
                </text>
                <rect
                  x={nomeW}
                  y={y + barH + 2}
                  width={w(m._count.neocampistas)}
                  height={barH}
                  rx="2"
                  fill={COR_CAMPISTAS}
                >
                  <title>{`${m.nome} — ${m._count.neocampistas} campistas`}</title>
                </rect>
                <text
                  x={nomeW + w(m._count.neocampistas) + 5}
                  y={y + barH * 2}
                  fontSize="10"
                  fill="var(--ink-soft)"
                  fontFamily="var(--font-plex-mono)"
                >
                  {m._count.neocampistas}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
