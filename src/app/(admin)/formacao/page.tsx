import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES } from "@/lib/constants";
import { normalizarBusca } from "@/lib/busca";
import { Icon } from "../servos/icons";
import SetorCard from "../servos/SetorCard";
import FormacaoToggle from "./FormacaoToggle";
import { CamisetaInlineSelect, PagoInlineSelect, FormaPagamentoInlineSelect } from "../servos/ServoInlineEdit";

export default async function FormacaoPage({ searchParams }: { searchParams: Promise<{ q?: string; setor?: string }> }) {
  await requireUser();
  const { q, setor } = await searchParams;
  const termo = q ? normalizarBusca(q) : "";
  const filtrando = Boolean(termo || setor);
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const todos = await db.servo.findMany({
    where: { missaoId: missao.id, status: "ATIVO" },
    include: { pessoa: true },
    orderBy: [{ setor: "asc" }, { pessoa: { nome: "asc" } }],
  });

  // filtra em JS para "joao" achar "João" (o contains do banco não ignora acento)
  const servos = todos.filter(
    (s) => (!setor || s.setor === setor) && (!termo || normalizarBusca(s.pessoa.nome).includes(termo)),
  );

  const setores = await db.setor.findMany({ orderBy: { nome: "asc" } });

  const grupos = new Map<string, typeof servos>();
  for (const nomeSetor of setores.map((se) => se.nome)) {
    grupos.set(nomeSetor, []);
  }
  for (const s of servos) {
    if (!grupos.has(s.setor)) grupos.set(s.setor, []);
    grupos.get(s.setor)!.push(s);
  }
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
      <h1 className="page-title mb-6">Formação</h1>

      <div className="qd-surface mb-6 p-3 sm:p-4">
        <form className="flex flex-wrap gap-2.5">
          <div className="relative w-full sm:min-w-64 sm:max-w-sm sm:flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa1b5]">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input name="q" defaultValue={q} placeholder="Buscar por nome do servo..." className="qd-field pl-9" />
          </div>
          <select name="setor" defaultValue={setor || ""} className="qd-field w-full sm:w-auto sm:min-w-52">
            <option value="">Todos os setores</option>
            {setores.map((se) => (
              <option key={se.id}>{se.nome}</option>
            ))}
          </select>
          <button className="qd-btn bg-[var(--ink)] px-5 py-2.5 text-white hover:bg-[#14295a]">Buscar</button>
          {(q || setor) && (
            <a href="/formacao" className="btn-link self-center text-sm">
              Limpar
            </a>
          )}
        </form>
      </div>

      {filtrando && servos.length === 0 && <p className="text-[var(--ink-soft)]/60">Nenhum servo encontrado.</p>}

      {[...grupos.entries()]
        .filter(([, lista]) => !filtrando || lista.length > 0)
        .map(([setorNome, lista]) => (
        <SetorCard key={setorNome} titulo={`${setorNome} (${lista.length})`} acao={null} iniciarAberto={filtrando}>
          {lista.length === 0 ? (
            <p className="px-4 py-4 text-sm text-[var(--ink-soft)]/60">Nenhum servo neste setor ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="qd-thead">
                  <tr>
                    <th className="text-left px-4 py-2">Nome</th>
                    <th className="text-left px-4 py-2">1ª Formação</th>
                    <th className="text-left px-4 py-2">2ª Formação</th>
                    <th className="text-left px-4 py-2">3ª Formação</th>
                    <th className="text-left px-4 py-2">Camiseta</th>
                    <th className="text-left px-4 py-2">Pago</th>
                    <th className="text-left px-4 py-2">Forma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {lista.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2">{s.pessoa.nome}</td>
                      <td className="px-4 py-2">
                        <FormacaoToggle servoId={s.id} numero={1} valor={s.formacao1} />
                      </td>
                      <td className="px-4 py-2">
                        <FormacaoToggle servoId={s.id} numero={2} valor={s.formacao2} />
                      </td>
                      <td className="px-4 py-2">
                        <FormacaoToggle servoId={s.id} numero={3} valor={s.formacao3} />
                      </td>
                      <td className="px-4 py-2">
                        <CamisetaInlineSelect servoId={s.id} camiseta={s.camiseta} />
                      </td>
                      <td className="px-4 py-2">
                        <PagoInlineSelect servoId={s.id} pago={s.pago} />
                      </td>
                      <td className="px-4 py-2">
                        <FormaPagamentoInlineSelect servoId={s.id} forma={s.pagamentoForma} />
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
