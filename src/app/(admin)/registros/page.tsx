import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { marcarAceitou } from "@/lib/actions";
import MotivoRow from "./MotivoRow";
import { ordenarSetores } from "@/lib/constants";
import FaltaRow from "./FaltaRow";

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

  const setoresRepescar = ordenarSetores(await db.setor.findMany({ orderBy: { nome: "asc" } })).map((x) => x.nome);

  const TabelaComMotivo = ({
    titulo,
    lista,
    campoMotivo,
    podeVoltar,
    podeRepescar,
  }: {
    titulo: string;
    lista: typeof recusaram;
    campoMotivo: "motivoRecusou" | "motivoDesistiu";
    podeVoltar?: boolean;
    podeRepescar?: boolean;
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
              {(podeVoltar || podeRepescar) && <th className="px-4 py-2"></th>}
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
                setoresRepescar={podeRepescar ? setoresRepescar : undefined}
              />
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={podeVoltar || podeRepescar ? 4 : 3} className="px-4 py-2 text-[var(--ink-soft)]/40">
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
            {faltaram.map((s) => (
              <FaltaRow
                key={s.id}
                nome={s.pessoa.nome}
                setor={s.setor}
                celular={s.pessoa.celular || "—"}
                motivoLegado={s.motivoFalta}
                formacoes={[
                  { numero: 1, faltou: s.formacao1 === "Não", motivo: s.motivoFalta1 },
                  { numero: 2, faltou: s.formacao2 === "Não", motivo: s.motivoFalta2 },
                  { numero: 3, faltou: s.formacao3 === "Não", motivo: s.motivoFalta3 },
                ]}
              />
            ))}
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
      <TabelaComMotivo titulo="Desistiram" lista={desistiram} campoMotivo="motivoDesistiu" podeRepescar />
      <TabelaFaltas />
    </div>
  );
}
