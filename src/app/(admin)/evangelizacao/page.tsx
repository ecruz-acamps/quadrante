import Link from "next/link";
import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { carregarPainel } from "@/lib/evangelizacaoDados";
import { BarraAcoes, CarroCheck, MoverSelect, ApagarEquipe } from "./Controles";

const AVISO_EQUIPE: Record<string, string> = {
  SEM_CARRO: "Sem carro",
  TAMANHO: "Tamanho diferente de 3",
  CIDADE_DESCONHECIDA: "Cidade de membro não reconhecida",
  NAO_VIZINHAS: "Cidades dos membros não são vizinhas",
};

function Selo({ texto, perigo = true }: { texto: string; perigo?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs border ${
        perigo
          ? "bg-[var(--signal-soft)] text-[var(--signal)] border-[var(--signal)]/30"
          : "bg-[var(--brass)]/15 text-[var(--ink)] border-[var(--brass)]/30"
      }`}
    >
      {texto}
    </span>
  );
}

export default async function EvangelizacaoPage() {
  const user = await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const p = await carregarPainel(missao.id);
  const equipesOpcoes = p.equipes.map((e) => ({ id: e.id, nome: e.nome }));
  const travada = p.fechada;
  const totalCasas = p.equipes.reduce((n, e) => n + e.casas.length, 0);

  return (
    <div>
      <h1 className="page-title mb-2">Evangelização: equipes e casas</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-4">
        Equipes de 3 com carro; as casas são repartidas na proporção dos carros de cada equipe (decisão da coordenação) e nenhuma equipe visita a cidade de um dos seus membros.
      </p>

      {travada && (
        <div className="card p-3 mb-4 text-sm text-[var(--ink)] border border-[var(--brass)]/40">
          Distribuição fechada: nada pode ser alterado.{" "}
          <Link href="/evangelizacao/imprimir" className="underline">
            Imprimir as folhas das equipes
          </Link>
        </div>
      )}

      <BarraAcoes missaoId={missao.id} fechada={travada} souSuper={user.role === "SUPER"} />

      <p className="text-sm mb-6">
        <Link href="/evangelizacao/cidades" className="underline">
          Cidades e vizinhança
        </Link>
        {p.cidadesDesconhecidas.length > 0 && (
          <span className="ml-2">
            <Selo texto={`${p.cidadesDesconhecidas.length} grafia(s) de cidade não reconhecida(s)`} />
          </span>
        )}
      </p>

      <div className="card p-4 mb-6 text-sm">
        <p>
          <strong>{p.equipes.length}</strong> equipe(s) · <strong>{totalCasas}</strong> casa(s) distribuída(s) ·{" "}
          <strong>{p.pendencias.length}</strong> pendente(s)
        </p>
        {p.casasPorCidade.length > 0 && (
          <p className="text-xs text-[var(--ink-soft)]/70 mt-2">
            Casas por cidade: {p.casasPorCidade.map(([c, n]) => `${c} (${n})`).join(" · ")}
          </p>
        )}
      </div>

      {p.servosSemEquipe.length > 0 && (
        <div className="card p-4 mb-6">
          <h2 className="font-medium mb-3 text-[var(--ink)]">Servos de Evangelização sem equipe ({p.servosSemEquipe.length})</h2>
          <ul className="space-y-2">
            {p.servosSemEquipe.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span>{s.nome}</span>
                <span className="text-xs text-[var(--ink-soft)]/60">{s.cidade ?? s.cidadeTexto ?? "sem cidade"}</span>
                {!s.cidade && <Selo texto="cidade não reconhecida" />}
                <CarroCheck servoId={s.id} valor={s.temCarro} desabilitado={travada} />
                <MoverSelect tipo="servo" id={s.id} atual={null} equipes={equipesOpcoes} desabilitado={travada} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.equipes.length === 0 && (
        <p className="text-sm text-[var(--ink-soft)]/60 mb-6">Nenhuma equipe ainda. Use “Sugerir equipes”.</p>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {p.equipes.map((e) => (
          <div key={e.id} className="table-shell">
            <div className="qd-card-head flex items-center justify-between">
              <span>
                {e.nome}{" "}
                <span className="text-xs font-normal text-[var(--ink-soft)]/70">
                  {e.carros} carro(s) · cota {e.cota} casa(s) · {e.casas.length} sorteada(s)
                </span>
              </span>
              <ApagarEquipe equipeId={e.id} desabilitado={travada} />
            </div>
            {(e.avisos.length > 0 || p.equipesAcimaDoLimite.includes(e.id)) && (
              <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-[var(--line)]">
                {e.avisos.map((a) => (
                  <Selo key={a} texto={AVISO_EQUIPE[a]} />
                ))}
                {p.equipesAcimaDoLimite.includes(e.id) && <Selo texto="Acima da cota de carros" />}
              </div>
            )}
            <div className="px-4 py-2 border-b border-[var(--line)]">
              <p className="text-xs font-medium text-[var(--ink-soft)]/70 mb-1">Membros</p>
              <ul className="space-y-1">
                {e.membros.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 text-sm">
                    <span>{m.nome}</span>
                    <span className="text-xs text-[var(--ink-soft)]/60">{m.cidade ?? m.cidadeTexto ?? "sem cidade"}</span>
                    <CarroCheck servoId={m.id} valor={m.temCarro} desabilitado={travada} />
                    <MoverSelect tipo="servo" id={m.id} atual={e.id} equipes={equipesOpcoes} desabilitado={travada} />
                  </li>
                ))}
              </ul>
            </div>
            <ul className="text-sm">
              {e.casas.map((c) => (
                <li key={c.id} className="px-4 py-2 border-t border-[var(--line)] first:border-t-0 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    #{c.numero} {c.nome}{" "}
                    <span className="text-xs text-[var(--ink-soft)]/60">
                      {[c.bairro, c.cidade ?? c.cidadeTexto].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {c.status === "IMPEDIDA" && <Selo texto="Cidade de um membro da equipe!" />}
                    {c.status === "CIDADE_DESCONHECIDA" && <Selo texto="Cidade não reconhecida" />}
                    {c.fixada && <Selo texto="fixada" perigo={false} />}
                    <MoverSelect tipo="casa" id={c.id} atual={e.id} equipes={equipesOpcoes} desabilitado={travada} />
                  </span>
                </li>
              ))}
              {e.casas.length === 0 && <li className="px-4 py-2 text-[var(--ink-soft)]/40 text-xs">Sem casas</li>}
            </ul>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-3 text-[var(--ink)]">Pendências ({p.pendencias.length})</h2>
        {p.pendencias.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]/60">Nenhuma ficha pendente.</p>
        ) : (
          <ul className="space-y-2">
            {p.pendencias.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span>
                  #{f.numero} {f.nome}
                </span>
                <span className="text-xs text-[var(--ink-soft)]/60">{f.cidadeTexto ?? "sem cidade"}</span>
                <Selo texto={f.motivo === "SEM_CIDADE" ? "Cidade não reconhecida" : "Nenhuma equipe pode visitar"} />
                <MoverSelect tipo="casa" id={f.id} atual={null} equipes={equipesOpcoes} desabilitado={travada} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
