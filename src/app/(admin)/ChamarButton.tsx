"use client";

import { useEffect, useState } from "react";
import { avisoChamado, mensagensChamado } from "@/lib/chamado";

// Mostra as mensagens padrão do chamado para copiar. O envio pelo WhatsApp entra depois.
export default function ChamarButton({ nome, missaoNome, setor }: { nome: string; missaoNome: string; setor: string }) {
  const [aberto, setAberto] = useState(false);
  const [copiada, setCopiada] = useState<number | null>(null);
  const mensagens = mensagensChamado({ nome, missaoNome, setor });
  const aviso = avisoChamado(nome);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  async function copiar(i: number) {
    try {
      await navigator.clipboard.writeText(mensagens[i]);
      setCopiada(i);
      setTimeout(() => setCopiada(null), 1500);
    } catch {
      /* sem permissão de área de transferência: o texto continua selecionável */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center rounded-md border border-[var(--line)] px-2 py-1 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[#eef1f8]"
      >
        Chamar
      </button>
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAberto(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Chamado de ${nome}`}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">Chamar {nome}</h2>
            {aviso && (
              <div role="alert" className="mb-3 rounded-md border-2 border-red-600 bg-red-50 p-3 text-center text-sm font-bold uppercase text-red-700">
                ⚠ Atenção: {aviso}
              </div>
            )}
            <div className="space-y-3">
              {mensagens.map((m, i) => (
                <div key={i} className="rounded-md border border-[var(--line)] p-3">
                  <p className="mb-1 text-[0.7rem] uppercase tracking-wider text-[var(--ink-soft)]/60">
                    {i + 1}ª mensagem{i === 2 ? " (depois do SIM)" : ""}
                  </p>
                  <p className="whitespace-pre-line text-sm text-[var(--ink)]">{m}</p>
                  <button
                    type="button"
                    onClick={() => copiar(i)}
                    className="mt-2 text-xs font-medium text-[var(--brass)] hover:underline"
                  >
                    {copiada === i ? "Copiada!" : "Copiar"}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 text-right">
              <button type="button" onClick={() => setAberto(false)} className="rounded-md px-3 py-1.5 text-sm hover:bg-[#eef1f8]">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
