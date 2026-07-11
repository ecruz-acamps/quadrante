"use client";

import { useEffect, useState } from "react";
import type { Neocampista } from "@prisma/client";
import { atualizarFicha } from "@/lib/actions";
import FichaForm from "./FichaForm";

export default function VerEditarFichaButton({ ficha }: { ficha: Neocampista }) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aberto]);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-link">
        Ver/Editar
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAberto(false);
          }}
        >
          <div className="card w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-spectral)] text-lg text-[var(--ink)]">
                Ficha {ficha.numero} — {ficha.nome}
              </h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="text-[var(--ink-soft)] hover:text-[var(--ink)] text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form action={atualizarFicha} className="space-y-4">
              <input type="hidden" name="id" value={ficha.id} />
              <FichaForm ficha={ficha} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAberto(false)} className="btn-link text-sm">
                  Cancelar
                </button>
                <button className="btn-primary px-4 py-1.5 text-sm">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
