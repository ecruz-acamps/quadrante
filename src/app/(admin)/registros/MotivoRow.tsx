"use client";

import { useState } from "react";

export default function MotivoRow({
  nome,
  setor,
  celular,
  motivo,
}: {
  nome: string;
  setor: string;
  celular: string;
  motivo: string | null;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <tr
        onClick={() => setAberto(true)}
        className="cursor-pointer hover:bg-[var(--paper)]"
      >
        <td className="px-4 py-2">{nome}</td>
        <td className="px-4 py-2">{setor}</td>
        <td className="px-4 py-2">{celular}</td>
      </tr>

      {aberto && (
        <tr>
          <td colSpan={3} className="p-0">
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
