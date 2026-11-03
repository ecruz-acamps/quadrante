"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarFormacao } from "@/lib/actions";

export default function FormacaoToggle({
  servoId,
  numero,
  valor,
}: {
  servoId: number;
  numero: 1 | 2 | 3;
  valor: string | null;
}) {
  const router = useRouter();
  const [abertoModal, setAbertoModal] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function marcar(presente: boolean, motivoTexto?: string, limpar = false) {
    setEnviando(true);
    setErro("");
    try {
      const formData = new FormData();
      formData.set("servoId", String(servoId));
      formData.set("numero", String(numero));
      formData.set("presente", String(presente));
      if (limpar) formData.set("limpar", "true");
      if (motivoTexto) formData.set("motivo", motivoTexto);
      await marcarFormacao(formData);
      setAbertoModal(false);
      setMotivo("");
      router.refresh();
    } catch {
      setErro("Não salvou. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={enviando}
        onClick={() => marcar(true)}
        className={`px-2 py-1 text-xs rounded border ${
          valor === "SIM"
            ? "bg-green-600/10 border-green-600 text-green-700"
            : "border-[var(--line)] text-[var(--ink-soft)]/70 hover:border-green-600"
        }`}
      >
        Compareceu
      </button>
      <button
        type="button"
        disabled={enviando}
        onClick={() => (valor === "Não" ? marcar(false, undefined, true) : setAbertoModal(true))}
        title={valor === "Não" ? "Clique para retirar a falta" : undefined}
        className={`px-2 py-1 text-xs rounded border ${
          valor === "Não"
            ? "bg-[var(--signal)]/10 border-[var(--signal)] text-[var(--signal)]"
            : "border-[var(--line)] text-[var(--ink-soft)]/70 hover:border-[var(--signal)]"
        }`}
      >
        Faltou
      </button>

      {erro && !abertoModal && (
        <span role="alert" className="ml-1 text-[0.7rem] text-[var(--signal)]">
          {erro}
        </span>
      )}

      {abertoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAbertoModal(false);
          }}
        >
          <div className="card w-full max-w-sm p-5 space-y-4">
            <p className="text-sm text-[var(--ink)]">Por que a pessoa faltou na {numero}ª formação?</p>
            <textarea
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional)"
              rows={3}
              className="input w-full"
            />
            {erro && (
              <p role="alert" className="text-sm text-[var(--signal)]">
                {erro}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAbertoModal(false)} className="btn-link text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => marcar(false, motivo.trim())}
                disabled={enviando}
                className="btn-primary px-4 py-1.5 text-sm"
              >
                {enviando ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
