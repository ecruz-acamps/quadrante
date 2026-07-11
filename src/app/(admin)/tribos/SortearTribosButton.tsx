"use client";

import { useActionState, useState } from "react";
import { sortearTribos } from "@/lib/actions";

export default function SortearTribosButton({ missaoId, quantidade }: { missaoId: number; quantidade: number }) {
  const [state, action, pending] = useActionState(sortearTribos, null);
  const [confirmando, setConfirmando] = useState(false);

  if (quantidade === 0) return null;

  return (
    <div className="mb-4">
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="btn-primary px-4 py-2 text-sm"
        >
          Sortear campistas para as tribos
        </button>
      ) : (
        <form action={action} className="card p-4 flex flex-col gap-3">
          <input type="hidden" name="missaoId" value={missaoId} />
          <p className="text-sm text-[var(--ink)]">
            Distribuir as {quantidade} fichas sem tribo entre as tribos existentes? Alocações manuais não serão
            alteradas.
          </p>
          <div className="flex gap-2">
            <button className="btn-primary px-4 py-2 text-sm" disabled={pending}>
              {pending ? "Sorteando..." : "Confirmar sorteio"}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="btn-link text-sm" disabled={pending}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {state && "error" in state && state.error && (
        <p className="text-sm text-[var(--signal)] mt-2">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <div className="text-sm text-[var(--ink)] mt-2">
          <p>{state.alocadas} ficha(s) alocada(s).</p>
          {state.pendentes.length > 0 && (
            <p className="text-[var(--signal)]">
              Pendentes (sem tribo elegível): {state.pendentes.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
