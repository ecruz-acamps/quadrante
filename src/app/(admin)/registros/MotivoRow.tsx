"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { repescarServo } from "@/lib/actions";

export default function MotivoRow({
  nome,
  setor,
  celular,
  motivo,
  servoId,
  voltarAction,
  setoresRepescar,
}: {
  nome: string;
  setor: string;
  celular: string;
  motivo: string | null;
  servoId?: number;
  voltarAction?: (formData: FormData) => Promise<void>; // devolve o servo ao quadrante (status ATIVO)
  setoresRepescar?: string[]; // quando informado, mostra o botão "Repescar" com a lista de setores
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const temAcao = !!voltarAction || !!setoresRepescar;

  async function repescar(setorDestino: string) {
    if (!servoId) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await repescarServo(servoId, setorDestino);
      if (r.error) {
        setErro(r.error);
        return;
      }
      setEscolhendo(false);
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <tr
        onClick={() => setAberto(true)}
        className="cursor-pointer hover:bg-[var(--paper)]"
      >
        <td className="px-4 py-2">{nome}</td>
        <td className="px-4 py-2">{setor}</td>
        <td className="px-4 py-2">{celular}</td>
        {voltarAction && (
          <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
            <form
              action={voltarAction}
              onSubmit={(e) => {
                if (!confirm(`Voltar ${nome} para o quadrante (${setor})?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={servoId} />
              <button className="btn-link">Voltar ao quadrante</button>
            </form>
          </td>
        )}
        {setoresRepescar && (
          <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { setErro(""); setEscolhendo(true); }} className="btn-link">
              Repescar
            </button>
          </td>
        )}
      </tr>

      {escolhendo && setoresRepescar && (
        <tr>
          <td colSpan={4} className="p-0">
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setEscolhendo(false);
              }}
            >
              <div className="card w-full max-w-sm p-5 space-y-4">
                <p className="text-sm text-[var(--ink)]">
                  Você quer repescar <strong>{nome}</strong> para qual setor?
                </p>
                <ul className="max-h-64 overflow-y-auto divide-y divide-[var(--line)] rounded border border-[var(--line)]">
                  {setoresRepescar.map((nomeSetor) => (
                    <li key={nomeSetor}>
                      <button
                        type="button"
                        disabled={enviando}
                        onClick={() => repescar(nomeSetor)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--paper)] disabled:opacity-50"
                      >
                        {nomeSetor}
                        {nomeSetor === setor && <span className="ml-2 text-xs text-[var(--ink-soft)]/60">(setor anterior)</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {erro && (
                  <p role="alert" className="text-sm text-[var(--signal)]">
                    {erro}
                  </p>
                )}
                <div className="flex justify-end">
                  <button type="button" onClick={() => setEscolhendo(false)} className="btn-link text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

      {aberto && (
        <tr>
          <td colSpan={temAcao ? 4 : 3} className="p-0">
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setAberto(false);
              }}
            >
              <div className="card w-full max-w-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-[var(--font-spectral)] text-lg text-[var(--ink)]">{nome}</h2>
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar"
                    className="text-[var(--ink-soft)] hover:text-[var(--ink)] text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
                <p className="text-sm text-[var(--ink)]">
                  {motivo || "Nenhum motivo foi informado."}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
