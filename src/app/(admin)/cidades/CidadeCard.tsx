"use client";

import { useState } from "react";

export default function CidadeCard({
  nomeCidade,
  servos,
}: {
  nomeCidade: string;
  servos: { id: number; pessoa: { nome: string }; setor: string }[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between bg-[var(--ink)] text-[var(--paper)] px-4 py-2 text-sm font-medium cursor-pointer"
      >
        <span>
          {nomeCidade} ({servos.length})
        </span>
        <span className={`transition-transform ${aberto ? "rotate-90" : ""}`}>▶</span>
      </button>
      {aberto && (
        <ul className="divide-y divide-[var(--line)] text-sm">
          {servos.map((s) => (
            <li key={s.id} className="px-4 py-2 flex justify-between">
              <span>{s.pessoa.nome}</span>
              <span className="text-[var(--ink-soft)]/60">{s.setor}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
