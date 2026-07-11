"use client";

import { useActionState } from "react";
import { alocarTribo } from "@/lib/actions";
import type { Neocampista, Tribo } from "@prisma/client";

export default function AlocarFichaForm({ ficha, tribos }: { ficha: Neocampista; tribos: Tribo[] }) {
  const [state, action, pending] = useActionState(alocarTribo, null);

  return (
    <form
      action={action}
      className="flex items-center gap-1 bg-[var(--card)] border border-[var(--line)] rounded-lg px-2 py-1"
    >
      <input type="hidden" name="fichaId" value={ficha.id} />
      <span className="text-xs text-[var(--ink)]">
        #{ficha.numero} {ficha.nome}
      </span>
      <select
        name="triboId"
        className="text-xs border border-[var(--line)] rounded px-1 py-0.5 bg-[var(--card)]"
        required
        disabled={pending}
      >
        <option value="">Tribo...</option>
        {tribos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>
      <button className="btn-primary text-xs px-2 py-0.5" disabled={pending}>
        OK
      </button>
      {state && "error" in state && state.error && (
        <span className="text-xs text-[var(--signal)] max-w-[220px]">{state.error}</span>
      )}
    </form>
  );
}
