import Link from "next/link";
import { requireUser, getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { ordenarSetores } from "@/lib/constants";
import { ligarConjuges } from "@/lib/servirConjuge";
import { listarPerguntasAtivas } from "@/lib/servirPerguntasDb";
import type { RespostaSalva } from "@/lib/servirRespostas";
import LinhaCandidato from "./LinhaCandidato";
import ServirConfig from "../configuracoes/ServirConfig";

type Busca = Record<string, string | undefined>;

function lerRespostas(json: string): RespostaSalva[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? (v as RespostaSalva[]) : [];
  } catch {
    return [];
  }
}

const valoresDe = (r?: RespostaSalva) => (r ? (Array.isArray(r.valor) ? r.valor : [r.valor]) : []);

export default async function CandidatosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const usuario = await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p className="text-sm">Selecione uma missão.</p>;
  const sp = await searchParams;

  const [todos, perguntas, setores] = await Promise.all([
    db.candidato.findMany({ where: { missaoId: missao.id }, orderBy: { criadoEm: "desc" } }),
    listarPerguntasAtivas(db),
    db.setor.findMany().then(ordenarSetores),
  ]);
  const ligacoes = ligarConjuges(todos);
  const porId = new Map(todos.map((c) => [c.id, c]));
  const itens = todos.map((c) => ({ c, respostas: lerRespostas(c.respostas) }));

  const status = sp.status ?? "PENDENTE";
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtroPergunta = perguntas
    .filter((p) => (p.tipo === "ESCOLHA_UMA" || p.tipo === "ESCOLHA_VARIAS") && sp[`f_${p.id}`])
    .map((p) => ({ id: p.id, valor: sp[`f_${p.id}`]! }));

  const visiveis = itens.filter(({ c, respostas }) => {
    if (status !== "TODOS" && c.status !== status) return false;
    if (sp.disp === "sim" && !c.disponivel) return false;
    if (sp.disp === "nao" && c.disponivel) return false;
    if (q && !c.nome.toLowerCase().includes(q)) return false;
    return filtroPergunta.every((f) => valoresDe(respostas.find((r) => r.perguntaId === f.id)).includes(f.valor));
  });

  const conta = (s: string) => todos.filter((c) => c.status === s).length;
  const abas = [
    ["PENDENTE", `Pendentes (${conta("PENDENTE")})`],
    ["APROVADO", `Aprovados (${conta("APROVADO")})`],
    ["RECUSADO", `Recusados (${conta("RECUSADO")})`],
    ["TODOS", `Todos (${todos.length})`],
  ] as const;
  const href = (extra: Busca) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) params.set(k, v);
    return `/candidatos?${params.toString()}`;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="page-title">Inscrição de servos</h1>
        <a href="/candidatos/exportar" className="btn-link px-3 py-2 text-sm">
          Exportar Excel
        </a>
      </div>
      <p className="text-sm text-[var(--ink-soft)]/80 mb-4">
        {missao.nome} · {missao.servirPublicado ? "recebendo candidaturas" : "candidaturas fechadas"} ·{" "}
        {todos.filter((c) => !c.disponivel).length} indisponíveis
      </p>

      {usuario.role === "SUPER" && (
        <div className="card p-4 mb-6">
          <h2 className="font-medium text-[var(--ink)] mb-1">Formulário público</h2>
          <p className="text-sm text-[var(--ink-soft)]/80 mb-3">
            Link para quem quer servir em {missao.nome}. Fechado, quem abrir o link vê “inscrições encerradas”.
          </p>
          <ServirConfig
            missaoId={missao.id}
            slug={missao.cercoSlug}
            servirPublicado={missao.servirPublicado}
            servirDatas={missao.servirDatas}
          />
        </div>
      )}

      <nav className="flex flex-wrap gap-3 mb-4 text-sm border-b border-[var(--line)]">
        {abas.map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={href({ status: valor })}
            className={`px-1 pb-2 ${status === valor ? "border-b-2 border-[var(--brass)] font-medium text-[var(--ink)]" : "text-[var(--ink-soft)]/70"}`}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap gap-2 mb-4 text-sm" action="/candidatos">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por nome" className="input w-48" />
        <select name="disp" defaultValue={sp.disp ?? ""} className="input w-40">
          <option value="">Disponível: todos</option>
          <option value="sim">Só disponíveis</option>
          <option value="nao">Só indisponíveis</option>
        </select>
        {perguntas
          .filter((p) => p.tipo === "ESCOLHA_UMA" || p.tipo === "ESCOLHA_VARIAS")
          .map((p) => (
            <select key={p.id} name={`f_${p.id}`} defaultValue={sp[`f_${p.id}`] ?? ""} className="input w-56" title={p.titulo}>
              <option value="">{p.titulo.slice(0, 40)}…</option>
              {p.opcoes.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}
        <button className="btn-link px-3">Filtrar</button>
      </form>

      {visiveis.length === 0 && <p className="text-sm text-[var(--ink-soft)]/70">Nenhum candidato neste filtro.</p>}
      <div className="space-y-3">
        {visiveis.map(({ c, respostas }) => {
          const parId = ligacoes.get(c.id);
          const par = parId ? porId.get(parId) : undefined;
          return (
            <LinhaCandidato
              key={c.id}
              missaoId={missao.id}
              setores={setores.map((s) => s.nome)}
              candidato={{
                id: c.id,
                nome: c.nome,
                celular: c.celular,
                cpf: c.cpf,
                casado: c.casado,
                conjugeNome: c.conjugeNome,
                conjugeCelular: c.conjugeCelular,
                disponivel: c.disponivel,
                status: c.status,
                criadoEm: c.criadoEm.toISOString(),
                respostas,
                conjuge: par ? { id: par.id, nome: par.nome } : null,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
