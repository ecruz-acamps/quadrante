import Link from "next/link";
import { requireUser, getMissaoAtiva, getMissoesPermitidas } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES, ordenarSetores } from "@/lib/constants";
import AdicionarServoModal from "./AdicionarServoModal";
import ChamarEvangelizacaoModal from "./ChamarEvangelizacaoModal";
import SetorCard from "./SetorCard";
import ReferenciaPanel from "./ReferenciaPanel";
import { QuadranteDndProvider } from "./QuadranteDnd";
import ChamarButton from "../ChamarButton";
import { CamisetaInlineSelect, PagoInlineSelect, FuncaoInlineSelect, CercoInlineSelect } from "./ServoInlineEdit";
import ExcluirDesistiuButtons from "./ExcluirDesistiuButtons";
import ExcluirIntegrantesButton from "./ExcluirIntegrantesButton";
import { Icon } from "./icons";
import { normalizarBusca } from "@/lib/busca";

// colunas da lista de servos no desktop (a largura é do card, via container query; abaixo disso vira card)
const COLUNAS = "@4xl:grid-cols-[minmax(0,1.7fr)_8.5rem_5rem_9.5rem_5.5rem_16.5rem]";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[0.65rem] font-medium uppercase tracking-wider text-[#8a92a8] @4xl:hidden">{rotulo}</span>
      {children}
    </div>
  );
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default async function ServosPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string; q?: string; ref?: string }>;
}) {
  const usuario = await requireUser();
  const { setor, q, ref } = await searchParams;
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

  const setores = await ordenarSetores(await db.setor.findMany({ orderBy: { nome: "asc" } }));
  const totalServos = await db.servo.count({ where: { missaoId: missao.id, status: "ATIVO" } });

  // painel de referência: outra edição ao lado (?ref=ID). ADMIN só enxerga as missões permitidas a ele.
  const candidatas = (
    usuario.role === "SUPER"
      ? await db.missao.findMany({ orderBy: { id: "desc" } })
      : await getMissoesPermitidas(usuario.id)
  ).filter((m) => m.id !== missao.id);
  const refMissao = ref ? candidatas.find((m) => m.id === Number(ref)) : undefined;
  const servosRef = refMissao
    ? await db.servo.findMany({
        where: { missaoId: refMissao.id },
        include: { pessoa: true },
        orderBy: [{ setor: "asc" }, { pessoa: { nome: "asc" } }],
      })
    : [];
  const pessoasNoQuadrante = refMissao
    ? (await db.servo.findMany({ where: { missaoId: missao.id }, select: { pessoaId: true } })).map((s) => s.pessoaId)
    : [];
  // edição sugerida ao abrir o painel: a mais recente com servos cadastrados
  const comServos = new Set(
    (await db.servo.groupBy({ by: ["missaoId"], _count: true })).filter((g) => g._count > 0).map((g) => g.missaoId),
  );
  const sugerida = candidatas.find((m) => comServos.has(m.id));

  const integrantesPorSetor = new Map(
    (
      await db.servo.groupBy({
        by: ["setor"],
        where: { missaoId: missao.id, status: "ATIVO", funcao: "INTEGRANTE" },
        _count: true,
      })
    ).map((c) => [c.setor, c._count]),
  );

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

  const href = (r: number | null) => {
    const p = new URLSearchParams();
    if (setor) p.set("setor", setor);
    if (q) p.set("q", q);
    if (r) p.set("ref", String(r));
    return `/servos${p.size ? `?${p}` : ""}`;
  };

  return (
    <QuadranteDndProvider missaoId={missao.id} ativo={Boolean(refMissao)}>
    <div className={refMissao ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-4 lg:h-[calc(100vh-3rem)]" : ""}>
    <div className={`mx-auto w-full max-w-6xl ${refMissao ? "lg:overflow-y-auto lg:min-h-0 lg:pr-1" : ""}`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
        <div>
          <h1 className="font-[var(--font-spectral)] text-3xl font-semibold tracking-tight text-[var(--ink)]">Quadrante de Servos</h1>
          <p className="mt-1 text-sm text-[#697089]">Organize os servos da missão por setor</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {refMissao ? (
            <Link href={href(null)} className="qd-btn qd-btn-ghost">
              <Icon name="compare" className="h-4 w-4 text-[var(--brass)]" />
              Fechar comparação
            </Link>
          ) : (
            sugerida && (
              <Link href={href(sugerida.id)} className="qd-btn qd-btn-ghost">
                <Icon name="compare" className="h-4 w-4 text-[var(--brass)]" />
                Comparar com outra edição
              </Link>
            )
          )}
          {/* download de arquivo: <a> de propósito, <Link> tentaria navegar */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/servos/exportar" className="qd-btn qd-btn-ghost">
            <Icon name="download" className="h-4 w-4 text-[var(--brass)]" />
            Exportar Excel
          </a>
          <ChamarEvangelizacaoModal missaoDestinoId={missao.id} />
          <Link href="/servos/novo" className="qd-btn qd-btn-cta px-4 py-2.5">
            <Icon name="plus" className="h-4 w-4" />
            Novo servo
          </Link>
        </div>
      </div>

      <div className="qd-surface mb-6 flex flex-wrap items-center justify-between gap-4 p-3 sm:p-4">
        <form className="flex w-full flex-wrap gap-2.5 lg:w-auto lg:flex-1">
          {refMissao && <input type="hidden" name="ref" value={refMissao.id} />}
          <div className="relative hidden w-full sm:block sm:w-auto sm:min-w-64 sm:flex-1 sm:max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa1b5]">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input name="q" defaultValue={q} placeholder="Buscar por nome do servo..." className="qd-field pl-9" />
          </div>
          <select name="setor" defaultValue={setor || ""} className="qd-field w-full sm:w-auto sm:min-w-52">
            <option value="">Todos os setores</option>
            {setores.map((s) => (
              <option key={s.id}>{s.nome}</option>
            ))}
          </select>
          <button className="qd-btn bg-[var(--ink)] px-5 py-2.5 text-white hover:bg-[#14295a]">Filtrar</button>
        </form>
        <div className="flex items-center gap-3 sm:border-l sm:border-[#eef0f5] sm:pl-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef1f8] text-[var(--ink)]">
            <Icon name="users" className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-[var(--ink)]">
              <span className="font-[var(--font-plex-mono)] text-lg">{totalServos}</span>{" "}
              {totalServos === 1 ? "servo cadastrado" : "servos cadastrados"}
            </div>
            <div className="text-xs text-[#8a92a8]">Total em todos os setores</div>
          </div>
        </div>
      </div>

      {[...grupos.entries()].map(([setorNome, lista]) => (
        <SetorCard
          key={setorNome}
          titulo={setorNome}
          quantidade={lista.length}
          setor={setorNome}
          iniciarAberto={Boolean(setor || q)}
          acao={
            <div className="flex shrink-0 items-center gap-1">
              <ExcluirIntegrantesButton
                missaoId={missao.id}
                setor={setorNome}
                integrantes={integrantesPorSetor.get(setorNome) ?? 0}
              />
              <AdicionarServoModal missaoId={missao.id} setor={setorNome} />
            </div>
          }
        >
          {lista.length === 0 ? (
            <div className="qd-fade-in flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3f5fb] text-[#8a92a8]">
                <Icon name="inbox" className="h-6 w-6" />
              </span>
              <p className="text-sm text-[#697089]">Este setor ainda não possui servos.</p>
              <AdicionarServoModal missaoId={missao.id} setor={setorNome} variante="vazio" />
            </div>
          ) : (
            <div className="@container">
              <div className={`hidden border-b border-[#eef0f5] bg-[#fafbfd] px-4 py-2 text-[0.68rem] font-medium uppercase tracking-wider text-[#8a92a8] @4xl:grid @4xl:gap-x-4 ${COLUNAS}`}>
                <span>Nome</span>
                <span>Função</span>
                <span>Camiseta</span>
                <span>Cerco</span>
                <span>Pago</span>
                <span className="text-right">Ações</span>
              </div>
              <div className="divide-y divide-[#eef0f5]">
                {lista.map((s) => (
                  <div
                    key={s.id}
                    data-nome={normalizarBusca(s.pessoa.nome)}
                    className={`grid grid-cols-2 gap-x-3 gap-y-3 px-4 py-4 transition-colors hover:bg-[#fafbfd] @4xl:items-center @4xl:gap-x-4 @4xl:gap-y-0 @4xl:py-2.5 ${COLUNAS}`}
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-3 @4xl:col-span-1">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef1f8] text-xs font-semibold text-[var(--ink)]">
                        {iniciais(s.pessoa.nome)}
                      </span>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/pessoas/${s.pessoaId}`}
                          className="truncate text-sm font-medium text-[var(--ink)] transition-colors hover:text-[var(--brass)]"
                        >
                          {s.pessoa.nome}
                        </Link>
                        {(missoesPorPessoa.get(s.pessoaId) ?? 1) > 1 && (
                          <span className="whitespace-nowrap rounded-full bg-[#faf3e0] px-2 py-0.5 font-[var(--font-plex-mono)] text-[0.65rem] font-medium text-[#8a6616]">
                            {missoesPorPessoa.get(s.pessoaId)}ª missão
                          </span>
                        )}
                      </div>
                    </div>
                    <Campo rotulo="Função">
                      <FuncaoInlineSelect servoId={s.id} funcao={s.funcao} />
                    </Campo>
                    <Campo rotulo="Camiseta">
                      <CamisetaInlineSelect servoId={s.id} camiseta={s.camiseta} />
                    </Campo>
                    <Campo rotulo="Cerco">
                      <CercoInlineSelect servoId={s.id} cercoHorario={s.cercoHorario} />
                    </Campo>
                    <Campo rotulo="Pago">
                      <PagoInlineSelect servoId={s.id} pago={s.pago} />
                    </Campo>
                    <div className="col-span-2 flex flex-wrap items-center justify-end gap-1 border-t border-[#eef0f5] pt-3 @4xl:col-span-1 @4xl:flex-nowrap @4xl:border-0 @4xl:pt-0">
                      <ChamarButton nome={s.pessoa.nome} missaoNome={missao.nome} setor={s.setor} />
                      <Link
                        href={`/servos/${s.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[#eef1f8]"
                      >
                        <Icon name="pencil" className="h-3.5 w-3.5 text-[var(--brass)]" />
                        Editar
                      </Link>
                      <ExcluirDesistiuButtons servoId={s.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SetorCard>
      ))}
      {grupos.size === 0 && <p className="text-[var(--ink-soft)]/60">Nenhum setor encontrado.</p>}
    </div>
    {refMissao && (
      <div className="mt-6 lg:mt-0 h-[70vh] lg:h-auto min-h-0">
        <ReferenciaPanel
          missoes={candidatas.map((m) => ({ id: m.id, nome: m.nome }))}
          refId={refMissao.id}
          setores={setores.map((x) => x.nome)}
          pessoasNoQuadrante={pessoasNoQuadrante}
          servos={servosRef.map((s) => ({
            id: s.id,
            pessoaId: s.pessoaId,
            nome: s.pessoa.nome,
            setor: s.setor,
            funcao: s.funcao,
            status: s.status,
            motivo: s.status === "DESISTIU" ? s.motivoDesistiu : s.status === "RECUSOU" ? s.motivoRecusou : null,
          }))}
        />
      </div>
    )}
    </div>
    </QuadranteDndProvider>
  );
}
