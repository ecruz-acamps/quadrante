import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoordenador } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeMarcarServo } from "@/lib/coordenador";
import { edicaoDe } from "@/lib/missoes";

// Histórico de serviço de um servo do setor do coordenador (só missões, setor, função e status; sem dados de contato)
export default async function HistoricoServoPage({ params }: { params: Promise<{ servoId: string }> }) {
  const { setor, missaoIds } = await requireCoordenador();
  const { servoId } = await params;
  const id = Number(servoId);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) notFound();

  const servo = await db.servo.findUnique({ where: { id }, select: { setor: true, missaoId: true, pessoaId: true } });
  if (!servo || !podeMarcarServo({ setor, missaoIds }, servo)) notFound();

  const pessoa = await db.pessoa.findUnique({
    where: { id: servo.pessoaId },
    select: {
      nome: true,
      servos: {
        select: {
          id: true,
          setor: true,
          funcao: true,
          status: true,
          missao: { select: { id: true, nome: true } },
          tribosLideradas: { select: { tribo: { select: { nome: true } } } },
        },
      },
    },
  });
  if (!pessoa) notFound();

  const participacoes = [...pessoa.servos].sort(
    (a, b) => edicaoDe(a.missao.nome) - edicaoDe(b.missao.nome) || a.missao.id - b.missao.id
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">{pessoa.nome}</h1>
        <Link href="/meu-setor" className="btn-link text-sm">
          ← Meu setor
        </Link>
      </div>
      <p className="mb-6 text-sm text-[var(--ink-soft)]/70">
        Histórico de serviço · {participacoes.length} {participacoes.length === 1 ? "missão" : "missões"}
      </p>

      <div className="card overflow-x-auto">
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
                <td className="px-4 py-2">{s.tribosLideradas.map((t) => t.tribo.nome).join(", ") || "—"}</td>
                <td className="px-4 py-2">
                  {s.status === "ATIVO" ? "Ativo" : <span className="text-[var(--signal)]">{s.status}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
