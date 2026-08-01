"use client";

import { useActionState } from "react";
import { atualizarMissao } from "@/lib/actions";
import { TIPOS_MISSAO, MESES } from "@/lib/constants";
import type { Missao } from "@prisma/client";

export default function EditarMissaoForm({ missao }: { missao: Missao }) {
  const [state, action, pending] = useActionState(atualizarMissao, null);

  return (
    <form action={action} className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input type="hidden" name="id" value={missao.id} />
      <input name="nome" required defaultValue={missao.nome} className="input col-span-2" />
      <select name="tipo" className="input" defaultValue={missao.tipo}>
        {TIPOS_MISSAO.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <input name="ano" type="number" required defaultValue={missao.ano} className="input" />
      <select name="mes" className="input" defaultValue={missao.mes ?? ""}>
        <option value="">Mês (opcional)</option>
        {MESES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <input
        name="anoCalendario"
        type="number"
        placeholder="Ano-calendário (ex: 2026)"
        defaultValue={missao.anoCalendario ?? ""}
        className="input"
      />
      <input name="cercoSlug" required defaultValue={missao.cercoSlug} className="input col-span-2" />
      <input name="valorInterna" type="number" step="0.01" defaultValue={missao.valorInterna} className="input" />
      <input name="valorExterna" type="number" step="0.01" defaultValue={missao.valorExterna} className="input" />
      <input name="valorCampista" type="number" step="0.01" defaultValue={missao.valorCampista} className="input" />
      {state && "error" in state && <p className="col-span-2 text-[var(--signal)] text-sm">{state.error}</p>}
      {state && "ok" in state && state.ok && (
        <p className="col-span-2 text-sm text-[var(--ink-soft)]/70">Salvo.</p>
      )}
      <button disabled={pending} className="btn-primary px-4 py-2 col-span-2">
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
