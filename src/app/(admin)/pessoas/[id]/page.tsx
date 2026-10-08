import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { edicaoDe } from "@/lib/missoes";

export default async function FichaPessoaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const pessoa = await db.pessoa.findUnique({
    where: { id: Number(id) },
    include: {
      servos: {
        include: {
          missao: { select: { id: true, nome: true } },
          tribosLideradas: { include: { tribo: { select: { nome: true } } } },
        },
      },
    },
  });
  if (!pessoa) notFound();

  const participacoes = [...pessoa.servos].sort(
    (a, b) => edicaoDe(a.missao.nome) - edicaoDe(b.missao.nome) || a.missao.id - b.missao.id
  );
  const setores = [...new Set(participacoes.map((s) => s.setor))];
  const vezesLider = participacoes.filter((s) => s.tribosLideradas.length > 0).length;

  const dados: [string, string | null][] = [
    ["Cidade", pessoa.cidade],
    ["Bairro", pessoa.bairro],
    ["Endereço", pessoa.endereco],
    ["Celular", pessoa.celular],
    ["E-mail", pessoa.email],
    ["Aniversário", pessoa.aniversario],
    ["Paróquia", pessoa.paroquia],
    ["Camiseta", pessoa.camiseta],
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">{pessoa.nome}</h1>
        <Link href="/pessoas" className="btn-link text-sm">
          ← Pessoas
        </Link>
      </div>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-6">
        {dados
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ") || "Sem dados de contato."}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-value">{participacoes.length}</div>
          <div className="stat-label">{participacoes.length === 1 ? "Missão" : "Missões"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{setores.length}</div>
          <div className="stat-label">{setores.length === 1 ? "Setor" : "Setores"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{vezesLider}</div>
          <div className="stat-label">Vezes líder de tribo</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{participacoes.filter((s) => s.status === "ATIVO").length}</div>
          <div className="stat-label">Participações ativas</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="qd-card-head">
          Histórico de missões
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="qd-thead">
            <tr>
              <th className="text-left px-4 py-2">Missão</th>
              <th className="text-left px-4 py-2">Setor</th>
              <th className="text-left px-4 py-2">Função</th>
              <th className="text-left px-4 py-2">Tribo liderada</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {participacoes.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">{s.missao.nome}</td>
                <td className="px-4 py-2">{s.setor}</td>
                <td className="px-4 py-2">{s.funcao}</td>
                <td className="px-4 py-2">
                  {s.tribosLideradas.map((t) => t.tribo.nome).join(", ") || "—"}
                </td>
                <td className="px-4 py-2">
                  {s.status === "ATIVO" ? (
                    "Ativo"
                  ) : (
                    <span className="text-[var(--signal)]">{s.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {participacoes.length === 0 && (
          <p className="text-[var(--ink-soft)]/60 p-4">Nenhuma participação registrada.</p>
        )}
      </div>
    </div>
  );
}
