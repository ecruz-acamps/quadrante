import { getMissaoAtiva, getMissoesPermitidas, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { linkWhatsapp } from "@/lib/chamado";
import { cruzar, filtrar, type FiltroCruzamento } from "@/lib/cruzamento";
import { edicaoDe, ordenarPorEdicao } from "@/lib/missoes";

const FILTROS: { valor: FiltroCruzamento; rotulo: string }[] = [
  { valor: "serviram", rotulo: "Estão / serviram na missão alvo" },
  { valor: "fora", rotulo: "Ainda NÃO estão na missão alvo" },
  { valor: "nunca", rotulo: "Nunca serviram (e não estão na alvo)" },
];

export default async function CruzamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string; alvo?: string; filtro?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const todas = user.role === "SUPER" ? await db.missao.findMany() : await getMissoesPermitidas(user.id);
  const missoes = ordenarPorEdicao(todas);
  const ativa = await getMissaoAtiva();

  const alvo = missoes.find((m) => m.id === Number(sp.alvo)) ?? missoes.find((m) => m.id === ativa?.id) ?? missoes[missoes.length - 1];
  // origem padrão: a edição anterior à alvo
  const origem =
    missoes.find((m) => m.id === Number(sp.origem)) ??
    (alvo ? missoes.find((m) => edicaoDe(m.nome) === edicaoDe(alvo.nome) - 2) ?? missoes[Math.max(missoes.length - 2, 0)] : undefined);
  const filtro = FILTROS.some((f) => f.valor === sp.filtro) ? (sp.filtro as FiltroCruzamento) : "nunca";

  if (!alvo || !origem) return <p>Nenhuma missão disponível.</p>;

  const ids = missoes.map((m) => m.id);
  const [campistas, servosDb] = await Promise.all([
    db.neocampista.findMany({ where: { missaoId: origem.id }, orderBy: { numero: "asc" } }),
    db.servo.findMany({ where: { missaoId: { in: ids } }, include: { pessoa: true, missao: { select: { nome: true } } } }),
  ]);

  const linhas = cruzar(
    campistas,
    servosDb.map((s) => ({
      nome: s.pessoa.nome,
      celular: s.pessoa.celular,
      missaoId: s.missaoId,
      missaoNome: s.missao.nome,
      status: s.status,
      setor: s.setor,
      funcao: s.funcao,
      confirmado: s.confirmado,
    })),
    alvo.id
  );
  const resultado = filtrar(linhas, filtro);
  const contagem = Object.fromEntries(FILTROS.map((f) => [f.valor, filtrar(linhas, f.valor).length]));

  return (
    <div>
      <h1 className="page-title mb-2">Cruzamentos</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-6">
        Cruza os campistas de uma missão com os servos de todas as missões. O casamento é pelo nome (sem acento nem
        diferença de maiúscula); celular igual ou nome parecido aparecem só como aviso.
      </p>

      <form className="flex flex-wrap items-end gap-3 mb-6">
        <label className="text-sm">
          <span className="block text-xs text-[var(--ink-soft)]/70 mb-1">Campistas da missão</span>
          <select name="origem" defaultValue={origem.id} className="input text-sm">
            {missoes.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-[var(--ink-soft)]/70 mb-1">Missão alvo (servos)</span>
          <select name="alvo" defaultValue={alvo.id} className="input text-sm">
            {missoes.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-[var(--ink-soft)]/70 mb-1">Mostrar</span>
          <select name="filtro" defaultValue={filtro} className="input text-sm">
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.rotulo} ({contagem[f.valor]})</option>
            ))}
          </select>
        </label>
        <button className="btn-primary px-4 py-2 text-sm">Cruzar</button>
      </form>

      <div className="card overflow-hidden">
        <div className="qd-card-head">
          {resultado.length} de {campistas.length} campistas de {origem.nome}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="qd-thead">
              <tr>
                <th className="text-left px-4 py-2">Ficha</th>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Celular</th>
                <th className="text-left px-4 py-2">Na missão alvo</th>
                <th className="text-left px-4 py-2">Já serviu em</th>
                <th className="text-left px-4 py-2">Avisos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {resultado.map((l) => {
                const zap = linkWhatsapp(l.campista.celular);
                return (
                  <tr key={l.campista.id}>
                    <td className="px-4 py-2 font-[var(--font-plex-mono)]">{l.campista.numero}</td>
                    <td className="px-4 py-2">{l.campista.nome}</td>
                    <td className="px-4 py-2">
                      {zap ? (
                        <a href={zap} target="_blank" rel="noreferrer" className="btn-link">
                          {l.campista.celular}
                        </a>
                      ) : (
                        l.campista.celular || "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {l.noAlvo
                        ? `${l.noAlvo.setor} / ${l.noAlvo.funcao} — ${l.noAlvo.status === "ATIVO" ? (l.noAlvo.confirmado ? "confirmado" : "ativo") : l.noAlvo.status.toLowerCase()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {l.outrasMissoes.length ? l.outrasMissoes.map((o) => `${edicaoDe(o.missaoNome)}º ${o.setor}`).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--signal)]">
                      {[
                        l.recusouAntes && "já recusou/desistiu antes",
                        l.avisoTelefone && `mesmo celular de ${l.avisoTelefone}`,
                        l.avisoParecido && `nome parecido: ${l.avisoParecido}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || ""}
                    </td>
                  </tr>
                );
              })}
              {resultado.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-2 text-[var(--ink-soft)]/40">Nenhum registro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
