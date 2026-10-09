import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";

export default async function FinanceiroPage() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const servos = await db.servo.findMany({
    where: { missaoId: missao.id, status: "ATIVO" },
  });

  // valor do servo vem da missão (campo "equipe interna"); pagamentoValor, se preenchido à mão, tem prioridade
  const valorServo = missao.valorInterna;

  const porSetor = new Map<
    string,
    { dinheiro: number; pix: number; isento: number; qtd: number; pagaram: number }
  >();
  let pagosSemForma = 0;
  for (const s of servos) {
    if (!porSetor.has(s.setor)) porSetor.set(s.setor, { dinheiro: 0, pix: 0, isento: 0, qtd: 0, pagaram: 0 });
    const g = porSetor.get(s.setor)!;
    g.qtd++;
    if (s.pago) g.pagaram++;
    if (s.pagamentoForma === "ISENTO") g.isento++;
    if (!s.pago) continue;
    const v = s.pagamentoValor ?? valorServo;
    if (s.pagamentoForma === "DINHEIRO") g.dinheiro += v;
    else if (s.pagamentoForma === "PIX" || s.pagamentoForma === "DÉBITO") g.pix += v;
    else if (!s.pagamentoForma) pagosSemForma++;
  }

  const fichas = await db.neocampista.findMany({ where: { missaoId: missao.id } });
  const fichasPagas = fichas.filter((f) => f.pagamento && f.pagamento !== "ISENTO").length;
  const fichasIsentas = fichas.filter((f) => f.pagamento === "ISENTO").length;
  const fichasDinheiro = fichas.filter((f) => f.pagamento === "DINHEIRO").length;
  const fichasPix = fichas.filter((f) => f.pagamento === "PIX" || f.pagamento === "DÉBITO").length;

  const totalServos = [...porSetor.values()].reduce((a, g) => a + g.dinheiro + g.pix, 0);
  const arrecadadoCampistas = (fichasDinheiro + fichasPix) * missao.valorCampista; // "pago em outra missão" não entra aqui
  const totalGeral = totalServos + arrecadadoCampistas;

  return (
    <div>
      <h1 className="page-title mb-6">Financeiro</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{brl(totalServos)}</div>
          <div className="stat-label">Arrecadado servos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{brl(arrecadadoCampistas)}</div>
          <div className="stat-label">Arrecadado campistas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{brl(totalGeral)}</div>
          <div className="stat-label">Total geral</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {fichasPagas}/{fichas.length}
          </div>
          <div className="stat-label">Neocampistas — pagos</div>
        </div>
      </div>

      {pagosSemForma > 0 && (
        <p className="mb-4 text-sm text-[var(--signal)]">
          {pagosSemForma} {pagosSemForma === 1 ? "servo marcado como pago está" : "servos marcados como pagos estão"} sem forma de
          pagamento e não {pagosSemForma === 1 ? "entrou" : "entraram"} na soma.
        </p>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="qd-thead">
            <tr>
              <th className="text-left px-4 py-2">Setor</th>
              <th className="text-left px-4 py-2">Dinheiro</th>
              <th className="text-left px-4 py-2">PIX/Débito</th>
              <th className="text-left px-4 py-2">Isento</th>
              <th className="text-left px-4 py-2">Qtd. servos</th>
              <th className="text-left px-4 py-2">Pagaram</th>
              <th className="text-left px-4 py-2">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {[...porSetor.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([setor, g]) => (
              <tr key={setor}>
                <td className="px-4 py-2">{setor}</td>
                <td className="px-4 py-2">{brl(g.dinheiro)}</td>
                <td className="px-4 py-2">{brl(g.pix)}</td>
                <td className="px-4 py-2">{g.isento}</td>
                <td className="px-4 py-2">{g.qtd}</td>
                <td className="px-4 py-2">{g.pagaram}</td>
                <td className="px-4 py-2">{g.qtd ? ((g.pagaram / g.qtd) * 100).toFixed(0) : 0}%</td>
              </tr>
            ))}
            <tr className="bg-[var(--paper)] font-medium">
              <td className="px-4 py-2">NEO-CAMPISTAS</td>
              <td className="px-4 py-2">{brl((fichasDinheiro * missao.valorCampista))}</td>
              <td className="px-4 py-2">{brl((fichasPix * missao.valorCampista))}</td>
              <td className="px-4 py-2">{fichasIsentas}</td>
              <td className="px-4 py-2">{fichas.length}</td>
              <td className="px-4 py-2">{fichasPagas}</td>
              <td className="px-4 py-2">{fichas.length ? ((fichasPagas / fichas.length) * 100).toFixed(0) : 0}%</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
