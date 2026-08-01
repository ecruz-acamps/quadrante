"use client";

import { useState } from "react";

export default function SetorCard({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao: React.ReactNode;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(true);

  return (
    <div className="mb-6 card overflow-hidden">
      <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 font-medium text-sm flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <span className={`inline-block transition-transform ${aberto ? "rotate-90" : ""}`}>▶</span>
          <span>{titulo}</span>
        </button>
        {acao}
      </div>
      {aberto && children}
    </div>
  );
}
