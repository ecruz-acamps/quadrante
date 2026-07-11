import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { CORES_TRIBO } from "@/lib/constants";
import { adicionarLiderTribo, removerLiderTribo } from "@/lib/actions";
import AlocarFichaForm from "./AlocarFichaForm";
import SortearTribosButton from "./SortearTribosButton";

const SWATCH: Record<string, string> = {
  "TRIBO AZUL": "#2255A4",
  "TRIBO VERMELHA": "#B4342A",
  "TRIBO VERDE": "#2E7D46",
  "TRIBO AMARELA": "#D9A62E",
  "TRIBO LARANJA": "#D2691E",
  "TRIBO ROXA": "#6B3FA0",
  "TRIBO PRETA": "#2A2A2A",
  "TRIBO MARROM": "#6B4226",
};

async function garantirTribos(missaoId: number) {
  const existentes = await db.tribo.findMany({ where: { missaoId } });
  const nomesExistentes = new Set(existentes.map((t) => t.nome));
  const faltando = CORES_TRIBO.filter((n) => !nomesExistentes.has(n));
  if (faltando.length) {
    await db.tribo.createMany({ data: faltando.map((nome) => ({ missaoId, nome })) });
  }
  return db.tribo.findMany({
    where: { missaoId },
    include: {
      neocampistas: true,
      lideres: { include: { servo: { include: { pessoa: true } } } },
    },
    orderBy: { nome: "asc" },
  });
}

function media(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default async function TribosPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const [tribos, fichasSemTribo, servos] = await Promise.all([
    garantirTribos(missao.id),
    db.neocampista.findMany({ where: { missaoId: missao.id, triboId: null }, orderBy: { numero: "asc" } }),
    db.servo.findMany({ where: { missaoId: missao.id, status: "ATIVO" }, include: { pessoa: true }, orderBy: { pessoa: { nome: "asc" } } }),
  ]);

  return (
    <div>
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Divisão de Tribos</h1>

      <SortearTribosButton missaoId={missao.id} quantidade={fichasSemTribo.length} />

      <div className="card p-4 mb-6">
        <h2 className="font-medium mb-3 text-[var(--ink)]">Fichas sem tribo ({fichasSemTribo.length})</h2>
        <div className="flex flex-wrap gap-2">
          {fichasSemTribo.map((f) => (
            <AlocarFichaForm key={f.id} ficha={f} tribos={tribos} />
          ))}
          {fichasSemTribo.length === 0 && <p className="text-sm text-[var(--ink-soft)]/60">Todas as fichas estão alocadas.</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {tribos.map((t) => {
          const homens = t.neocampistas.filter((n) => n.sexo === "MASCULINO").length;
          const mulheres = t.neocampistas.filter((n) => n.sexo === "FEMININO").length;
          const idades = t.neocampistas.map((n) => n.idade).filter((x): x is number => x != null);
          const pesos = t.neocampistas.map((n) => n.peso).filter((x): x is number => x != null);
          const alturas = t.neocampistas.map((n) => n.altura).filter((x): x is number => x != null);

          const cor = SWATCH[t.nome] || "var(--brass)";

          return (
            <div key={t.id} className="table-shell">
              <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 font-medium text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-white/30"
                    style={{ background: cor }}
                    aria-hidden
                  />
                  {t.nome}
                </span>
                <span className="font-mono">{t.neocampistas.length} fichas</span>
              </div>
              <div className="px-4 py-2 text-xs text-[var(--ink-soft)]/70 border-b border-[var(--line)] flex gap-3 flex-wrap">
                <span>H: {homens}</span>
                <span>M: {mulheres}</span>
                <span>Idade média: {media(idades).toFixed(0)} anos</span>
                <span>Peso médio: {media(pesos).toFixed(0)} kg</span>
                <span>Altura média: {media(alturas).toFixed(2)} m</span>
              </div>
              <div className="px-4 py-2 border-b border-[var(--line)]">
                <p className="text-xs font-medium text-[var(--ink-soft)]/70 mb-1">Líderes</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {t.lideres.map((l) => (
                    <span
                      key={l.id}
                      className="text-xs bg-[var(--brass)]/15 text-[var(--ink)] rounded-full px-2 py-1 border border-[var(--brass)]/30"
                    >
                      {l.servo.pessoa.nome}
                      <form action={removerLiderTribo} className="inline ml-1">
                        <input type="hidden" name="id" value={l.id} />
                        <button className="text-[var(--signal)]">×</button>
                      </form>
                    </span>
                  ))}
                </div>
                <form action={adicionarLiderTribo} className="flex gap-2">
                  <input type="hidden" name="triboId" value={t.id} />
                  <select name="servoId" className="input py-1 text-xs flex-1" required>
                    <option value="">Adicionar líder...</option>
                    {servos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.pessoa.nome}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary text-xs px-3">+</button>
                </form>
              </div>
              <ul className="text-sm">
                {t.neocampistas
                  .sort((a, b) => a.numero - b.numero)
                  .map((n) => (
                    <li key={n.id} className="px-4 py-2 flex justify-between border-t border-[var(--line)] first:border-t-0">
                      <span>
                        #{n.numero} {n.nome}
                      </span>
                      <span className="text-[var(--ink-soft)]/60 font-mono">
                        {n.sexo === "MASCULINO" ? "M" : n.sexo === "FEMININO" ? "F" : ""}
                      </span>
                    </li>
                  ))}
                {t.neocampistas.length === 0 && (
                  <li className="px-4 py-2 text-[var(--ink-soft)]/40 text-xs">Vazia</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
