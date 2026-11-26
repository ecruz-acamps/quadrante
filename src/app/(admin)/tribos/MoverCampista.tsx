"use client";

import { useActionState } from "react";
import { alocarTribo } from "@/lib/actions";

// Mover um campista que já está numa tribo para outra (ou tirá-lo da tribo). Tribos com trava (alerta de
// parentesco/amizade com alguém de lá, ou líder de lá que conhece o campista) aparecem desabilitadas com o motivo;
// o servidor confere de novo as mesmas travas.
export type OpcaoTribo = { id: number; nome: string; trava: string | null };

export default function MoverCampista({ fichaId, opcoes }: { fichaId: number; opcoes: OpcaoTribo[] }) {
  const [state, action, pending] = useActionState(alocarTribo, null);
  return (
    <form action={action} className="flex flex-col items-end gap-0.5">
      <input type="hidden" name="fichaId" value={fichaId} />
      <span className="flex items-center gap-1">
        <select
          name="triboId"
          defaultValue="mover"
          disabled={pending}
          className="text-xs border border-[var(--line)] rounded px-1 py-0.5 bg-[var(--card)] max-w-[11rem]"
          aria-label="Mover para outra tribo"
          onChange={(e) => {
            if (e.target.value !== "mover") e.currentTarget.form?.requestSubmit();
          }}
        >
          <option value="mover" disabled>
            {pending ? "Movendo…" : "Mover para…"}
          </option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id} disabled={Boolean(o.trava)}>
              {o.nome}
              {o.trava ? ` (trava: ${o.trava})` : ""}
            </option>
          ))}
          <option value="">Tirar da tribo</option>
        </select>
      </span>
      {state && "error" in state && state.error && <span className="text-xs text-[var(--signal)] max-w-[16rem] text-right">{state.error}</span>}
    </form>
  );
}
