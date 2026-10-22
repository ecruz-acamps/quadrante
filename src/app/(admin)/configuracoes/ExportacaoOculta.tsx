"use client";

import { useState, useTransition } from "react";
import { definirOcultarNaExportacao } from "@/lib/actions";

type Pessoa = { id: number; nome: string; setor?: string };

export default function ExportacaoOculta({ ocultas, candidatas }: { ocultas: Pessoa[]; candidatas: Pessoa[] }) {
  const [pending, startTransition] = useTransition();
  const [escolhida, setEscolhida] = useState("");

  const alterar = (id: number, ocultar: boolean) => startTransition(() => definirOcultarNaExportacao(id, ocultar));

  return (
    <div className="card p-4">
      <p className="text-sm text-[var(--ink-soft)]/80 mb-4">
        Pessoas desta lista não aparecem nos Excels exportados (quadrante por setor e grade do Cerco). Remova da lista
        para voltarem a aparecer.
      </p>

      {ocultas.length === 0 ? (
        <p className="text-xs text-[var(--ink-soft)]/60 mb-4">Ninguém oculto.</p>
      ) : (
        <ul className="divide-y divide-[var(--line)] mb-4">
          {ocultas.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm text-[var(--ink)]">
              <span>{p.nome}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => alterar(p.id, false)}
                className="text-[var(--signal)] text-xs"
              >
                Voltar a exibir
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <select value={escolhida} onChange={(e) => setEscolhida(e.target.value)} className="input flex-1">
          <option value="">Ocultar outra pessoa…</option>
          {candidatas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {p.setor ? ` — ${p.setor}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !escolhida}
          onClick={() => {
            alterar(Number(escolhida), true);
            setEscolhida("");
          }}
          className="rounded px-4 py-2 bg-[var(--brass)] text-[var(--ink)] font-medium disabled:opacity-50"
        >
          Ocultar
        </button>
      </div>
    </div>
  );
}
