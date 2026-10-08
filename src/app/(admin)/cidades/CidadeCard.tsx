"use client";

import { Icon } from "../servos/icons";
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
        className="qd-card-head flex w-full cursor-pointer items-center justify-between transition-colors hover:bg-[#f6f7fb]"
      >
        <span>
          {nomeCidade} ({servos.length})
        </span>
        <span className={`text-[#8a92a8] transition-transform duration-200 ${aberto ? "rotate-90" : ""}`}><Icon name="chevron" className="h-4 w-4" /></span>
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
