import { getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES } from "@/lib/constants";
import SetorCard from "../servos/SetorCard";
import FormacaoToggle from "./FormacaoToggle";

export default async function FormacaoPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const servos = await db.servo.findMany({
    where: { missaoId: missao.id, status: "ATIVO" },
    include: { pessoa: true },
    orderBy: [{ setor: "asc" }, { pessoa: { nome: "asc" } }],
  });

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

      {[...grupos.entries()].map(([setorNome, lista]) => (
        <SetorCard key={setorNome} titulo={`${setorNome} (${lista.length})`} acao={null}>
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
