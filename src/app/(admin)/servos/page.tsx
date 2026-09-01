import Link from "next/link";
import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES } from "@/lib/constants";
import AdicionarServoModal from "./AdicionarServoModal";
import ChamarEvangelizacaoModal from "./ChamarEvangelizacaoModal";
import SetorCard from "./SetorCard";
import { CamisetaInlineSelect, PagoInlineSelect, FuncaoInlineSelect, CercoInlineSelect } from "./ServoInlineEdit";
import ExcluirDesistiuButtons from "./ExcluirDesistiuButtons";

export default async function ServosPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string; q?: string }>;
}) {
  const { setor, q } = await searchParams;
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const servos = await db.servo.findMany({
    where: {
      missaoId: missao.id,
      status: "ATIVO",
      setor: setor || undefined,
      pessoa: q ? { nome: { contains: q } } : undefined,
    },
    include: { pessoa: true },
    orderBy: [{ setor: "asc" }, { pessoa: { nome: "asc" } }],
  });

  const setores = await db.setor.findMany({ orderBy: { nome: "asc" } });

  // veterania: total de missões de cada pessoa (todas as edições)
  const contagens = await db.servo.groupBy({
    by: ["pessoaId"],
    where: { pessoaId: { in: servos.map((s) => s.pessoaId) } },
    _count: true,
  });
  const missoesPorPessoa = new Map(contagens.map((c) => [c.pessoaId, c._count]));

  const grupos = new Map<string, typeof servos>();
  for (const nomeSetor of setores.map((se) => se.nome)) {
    if (setor && nomeSetor !== setor) continue;
    grupos.set(nomeSetor, []);
  }
  for (const s of servos) {
    if (!grupos.has(s.setor)) grupos.set(s.setor, []);
    grupos.get(s.setor)!.push(s);
  }
  // dentro de cada setor: COORDENADOR -> AUXILIAR -> APOIO -> INTEGRANTE, depois por nome
  for (const lista of grupos.values()) {
    lista.sort((a, b) => {
      const fa = FUNCOES.indexOf(a.funcao);
      const fb = FUNCOES.indexOf(b.funcao);
      if (fa !== fb) return (fa === -1 ? FUNCOES.length : fa) - (fb === -1 ? FUNCOES.length : fb);
      return a.pessoa.nome.localeCompare(b.pessoa.nome);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)]">Quadrante de Servos</h1>
        <div className="flex items-center gap-2">
          <ChamarEvangelizacaoModal missaoDestinoId={missao.id} />
          <Link href="/servos/novo" className="btn-primary px-4 py-2 text-sm">
            + Novo servo
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-3 mb-6">
        <input name="q" defaultValue={q} placeholder="Buscar por nome" className="input text-sm w-full sm:w-auto sm:flex-1 sm:max-w-xs" />
        <select name="setor" defaultValue={setor || ""} className="input text-sm w-full sm:w-auto">
          <option value="">Todos os setores</option>
          {setores.map((s) => (
            <option key={s.id}>{s.nome}</option>
          ))}
        </select>
        <button className="btn-primary px-4 py-2 text-sm">Filtrar</button>
      </form>

      {[...grupos.entries()].map(([setorNome, lista]) => (
        <SetorCard
          key={setorNome}
          titulo={`${setorNome} (${lista.length})`}
          acao={<AdicionarServoModal missaoId={missao.id} setor={setorNome} />}
        >
          {lista.length === 0 ? (
            <p className="px-4 py-4 text-sm text-[var(--ink-soft)]/60">Nenhum servo neste setor ainda.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper)] text-[var(--ink-soft)]/60">
                <tr>
                  <th className="text-left px-4 py-2">Nome</th>
                  <th className="text-left px-4 py-2">Função</th>
                  <th className="text-left px-4 py-2">Camiseta</th>
                  <th className="text-left px-4 py-2">Cerco</th>
                  <th className="text-left px-4 py-2">Pago</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {lista.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2">
                      <Link href={`/pessoas/${s.pessoaId}`} className="hover:underline">
                        {s.pessoa.nome}
                      </Link>
                      {(missoesPorPessoa.get(s.pessoaId) ?? 1) > 1 && (
                        <span className="ml-2 text-[0.65rem] font-[var(--font-plex-mono)] text-[var(--brass)] border border-[var(--brass)]/40 rounded px-1 py-px align-middle whitespace-nowrap">
                          {missoesPorPessoa.get(s.pessoaId)}ª missão
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <FuncaoInlineSelect servoId={s.id} funcao={s.funcao} />
                    </td>
                    <td className="px-4 py-2">
                      <CamisetaInlineSelect servoId={s.id} camiseta={s.camiseta} />
                    </td>
                    <td className="px-4 py-2">
                      <CercoInlineSelect servoId={s.id} cercoHorario={s.cercoHorario} />
                    </td>
                    <td className="px-4 py-2">
                      <PagoInlineSelect servoId={s.id} pago={s.pago} />
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Link href={`/servos/${s.id}`} className="btn-link">
                        Editar
                      </Link>
                      <ExcluirDesistiuButtons servoId={s.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </SetorCard>
      ))}
      {grupos.size === 0 && <p className="text-[var(--ink-soft)]/60">Nenhum setor encontrado.</p>}
    </div>
  );
}
