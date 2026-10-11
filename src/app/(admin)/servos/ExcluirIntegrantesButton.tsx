"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { excluirIntegrantesSetor } from "@/lib/actions";

export default function ExcluirIntegrantesButton({
  missaoId,
  setor,
  integrantes,
}: {
  missaoId: number;
  setor: string;
  integrantes: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (integrantes === 0) return null;

  async function confirmar() {
    setEnviando(true);
    setErro("");
    try {
      const formData = new FormData();
      formData.set("missaoId", String(missaoId));
      formData.set("setor", setor);
      await excluirIntegrantesSetor(formData);
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Não foi possível excluir. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErro("");
          setAberto(true);
        }}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-[#8a92a8] transition-colors hover:bg-[var(--signal-soft)] hover:text-[var(--signal)]"
      >
        Excluir integrantes
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !enviando) setAberto(false);
          }}
        >
          <div className="card w-full max-w-sm p-5 space-y-4">
            <p className="text-sm text-[var(--ink)]">
              Excluir {integrantes === 1 ? "o 1 integrante" : `os ${integrantes} integrantes`} do setor <strong>{setor}</strong>? Coordenadores,
              auxiliares e apoio serão mantidos. Esta ação não pode ser desfeita.
            </p>
            {erro && (
              <p role="alert" className="text-sm text-[var(--signal)]">
                {erro}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAberto(false)} disabled={enviando} className="btn-link text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                className="px-3 py-1.5 text-sm rounded bg-[var(--signal)] text-[var(--paper)] hover:opacity-90 disabled:opacity-50"
              >
                {enviando ? "Excluindo..." : "Excluir integrantes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
