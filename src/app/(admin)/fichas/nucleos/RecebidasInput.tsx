"use client";

import { useActionState, useRef } from "react";
import { salvarRecebidasNucleo } from "@/lib/actions";

// campo "Recebeu" de um núcleo: salva ao sair do campo ou com Enter
export default function RecebidasInput({ missaoId, nucleo, valor }: { missaoId: number; nucleo: string; valor: number }) {
  const [estado, salvar, salvando] = useActionState(salvarRecebidasNucleo, null);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={salvar} className="flex items-center gap-2">
      <input type="hidden" name="missaoId" value={missaoId} />
      <input type="hidden" name="nucleo" value={nucleo} />
      <input
        name="recebidas"
        type="number"
        min={0}
        max={9999}
        defaultValue={valor || ""}
        placeholder="0"
        aria-label={`Fichas que ${nucleo} recebeu`}
        className="input py-1 w-20 text-right font-mono"
        onBlur={(e) => {
          if (e.currentTarget.value !== String(valor || "")) form.current?.requestSubmit();
        }}
      />
      <span className="text-xs w-14">
        {salvando ? "…" : estado?.erro ? <span className="text-[var(--signal)]">{estado.erro}</span> : estado?.ok ? <span className="text-green-700">salvo</span> : null}
      </span>
    </form>
  );
}
