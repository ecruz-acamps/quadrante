import { requireCoordenador } from "@/lib/auth";
import { db } from "@/lib/db";
import { FUNCOES } from "@/lib/constants";
import StatusServoButtons from "./StatusServoButtons";
import Link from "next/link";
import ChamarButton from "../ChamarButton";
import { linkWhatsapp, mensagensChamado } from "@/lib/chamado";
import CamisetaSelect from "./CamisetaSelect";

export default async function MeuSetorPage() {
  const { setor, missao } = await requireCoordenador();

  if (!setor || !missao) {
    return (
      <div className="max-w-2xl">
        <h1 className="page-title mb-4">Meu setor</h1>
        <p className="text-sm text-[var(--ink-soft)]/70">
          Seu acesso ainda não está completo. Peça ao administrador para definir o seu setor e a sua missão.
        </p>
      </div>
    );
  }

  const servos = await db.servo.findMany({
    where: { missaoId: missao.id, setor },
    include: { pessoa: true },
  });
  const ordem = (f: string) => {
    const i = FUNCOES.indexOf(f);
    return i === -1 ? FUNCOES.length : i;
  };
  servos.sort((a, b) => ordem(a.funcao) - ordem(b.funcao) || a.pessoa.nome.localeCompare(b.pessoa.nome));

  return (
    <div className="max-w-4xl">
      <h1 className="page-title mb-1">Meu setor</h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]/70">
        {setor} · {missao.nome} · {servos.length} {servos.length === 1 ? "servo" : "servos"}
      </p>

      {servos.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]/60">Nenhum servo neste setor ainda.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="qd-thead">
              <tr>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Função</th>
                <th className="text-left px-4 py-2">Celular</th>
                <th className="text-left px-4 py-2">Camiseta</th>
                <th className="text-left px-4 py-2">Vai servir?</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {servos.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2">
                    <Link href={`/meu-setor/historico/${s.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--brass)] hover:underline">
                      {s.pessoa.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{s.funcao}</td>
                  <td className="px-4 py-2">
                    {linkWhatsapp(s.pessoa.celular, mensagensChamado({ nome: s.pessoa.nome, missaoNome: missao.nome, setor: s.setor })[0]) ? (
                      <a
                        href={linkWhatsapp(s.pessoa.celular, mensagensChamado({ nome: s.pessoa.nome, missaoNome: missao.nome, setor: s.setor })[0])!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--brass)] hover:underline"
                        title="Abrir conversa no WhatsApp"
                      >
                        {s.pessoa.celular}
                      </a>
                    ) : (
                      s.pessoa.celular ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-2"><CamisetaSelect servoId={s.id} camiseta={s.camiseta} /></td>
                  <td className="px-4 py-2">
                    <StatusServoButtons
                      servoId={s.id}
                      status={s.status}
                      confirmado={s.confirmado}
                      motivo={s.status === "DESISTIU" ? s.motivoDesistiu : s.status === "RECUSOU" ? s.motivoRecusou : null}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ChamarButton nome={s.pessoa.nome} missaoNome={missao.nome} setor={s.setor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
