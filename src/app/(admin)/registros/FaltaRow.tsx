"use client";

import { useState } from "react";

export type FormacaoFalta = { numero: 1 | 2 | 3; faltou: boolean; motivo: string | null };

export default function FaltaRow({
  nome,
  setor,
  celular,
  formacoes,
  motivoLegado,
}: {
  nome: string;
  setor: string;
  celular: string;
  formacoes: FormacaoFalta[];
  motivoLegado: string | null; // motivo único antigo, usado só quando nenhuma formação tem motivo próprio
}) {
  const [aberto, setAberto] = useState(false);
  const faltas = formacoes.filter((f) => f.faltou);
  const temMotivoPorFormacao = faltas.some((f) => f.motivo);

  return (
    <>
      <tr onClick={() => setAberto(true)} className="cursor-pointer hover:bg-[var(--paper)]">
        <td className="px-4 py-2">{nome}</td>
        <td className="px-4 py-2">{setor}</td>
        <td className="px-4 py-2">{celular}</td>
        <td className="px-4 py-2">
          <div className="flex gap-1">
            {faltas.map((f) => (
              <span
                key={f.numero}
                className="text-[0.65rem] font-[var(--font-plex-mono)] text-[var(--signal)] border border-[var(--signal)]/40 rounded px-1 py-px"
              >
                {f.numero}ª formação
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-2 text-xs">
          {temMotivoPorFormacao ? (
            <ul className="space-y-0.5">
              {faltas.map((f) => f.motivo && (
                <li key={f.numero}>
                  <span className="text-[var(--ink-soft)]/60">{f.numero}ª:</span> {f.motivo}
                </li>
              ))}
            </ul>
          ) : (
            motivoLegado || "—"
          )}
        </td>
      </tr>

      {aberto && (
        <tr>
          <td colSpan={5} className="p-0">
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
                <ul className="space-y-3 text-sm text-[var(--ink)]">
                  {formacoes.map((f) => (
                    <li key={f.numero}>
                      <p className="text-xs uppercase tracking-wider text-[var(--ink-soft)]/60">
                        {f.numero}ª formação
                      </p>
                      {f.faltou ? (
                        <p>
                          <span className="text-[var(--signal)]">Faltou.</span>{" "}
                          {f.motivo || (!temMotivoPorFormacao && motivoLegado) || "Nenhum motivo foi informado."}
                        </p>
                      ) : (
                        <p className="text-[var(--ink-soft)]/70">Sem falta registrada.</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
