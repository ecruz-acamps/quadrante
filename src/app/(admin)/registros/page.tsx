import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { marcarAceitou } from "@/lib/actions";
import MotivoRow from "./MotivoRow";

export default async function RegistrosPage() {
  await requireUser();
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

  const TabelaComMotivo = ({
    titulo,
    lista,
    campoMotivo,
    podeVoltar,
  }: {
    titulo: string;
    lista: typeof recusaram;
    campoMotivo: "motivoRecusou" | "motivoDesistiu";
    podeVoltar?: boolean;
  }) => (
    <div className="card overflow-hidden mb-6">
      <div className="qd-card-head">
        {titulo} ({lista.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="qd-thead">
            <tr>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">Setor</th>
              <th className="text-left px-4 py-2">Celular</th>
              {podeVoltar && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {lista.map((s) => (
              <MotivoRow
                key={s.id}
                nome={s.pessoa.nome}
                setor={s.setor}
                celular={s.pessoa.celular || "—"}
                motivo={s[campoMotivo]}
                servoId={s.id}
                voltarAction={podeVoltar ? marcarAceitou : undefined}
              />
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={podeVoltar ? 4 : 3} className="px-4 py-2 text-[var(--ink-soft)]/40">
                  Nenhum registro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const TabelaFaltas = () => (
    <div className="card overflow-hidden mb-6">
      <div className="qd-card-head">
        Faltaram na formação ({faltaram.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="qd-thead">
            <tr>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">Setor</th>
              <th className="text-left px-4 py-2">Celular</th>
              <th className="text-left px-4 py-2">Faltou em</th>
              <th className="text-left px-4 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {faltaram.map((s) => {
              const faltas = [
                s.formacao1 === "Não" && "1ª",
                s.formacao2 === "Não" && "2ª",
                s.formacao3 === "Não" && "3ª",
              ].filter(Boolean) as string[];
              return (
                <tr key={s.id}>
                  <td className="px-4 py-2">{s.pessoa.nome}</td>
                  <td className="px-4 py-2">{s.setor}</td>
                  <td className="px-4 py-2">{s.pessoa.celular || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {faltas.map((f) => (
                        <span
                          key={f}
                          className="text-[0.65rem] font-[var(--font-plex-mono)] text-[var(--signal)] border border-[var(--signal)]/40 rounded px-1 py-px"
                        >
                          {f} formação
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">{s.motivoFalta || "—"}</td>
                </tr>
              );
            })}
            {faltaram.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-2 text-[var(--ink-soft)]/40">
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
      <h1 className="page-title mb-6">Não / Desistências / Faltas na formação</h1>
      <TabelaComMotivo titulo="Falaram NÃO ao chamado" lista={recusaram} campoMotivo="motivoRecusou" podeVoltar />
      <TabelaComMotivo titulo="Desistiram" lista={desistiram} campoMotivo="motivoDesistiu" />
      <TabelaFaltas />
    </div>
  );
}
