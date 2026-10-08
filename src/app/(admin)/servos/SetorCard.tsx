"use client";

import { useState } from "react";
import { MIME_PESSOA, useQuadranteDnd } from "./QuadranteDnd";
import { Icon, setorVisual } from "./icons";

export default function SetorCard({
  titulo,
  setor,
  quantidade,
  acao,
  children,
}: {
  titulo: string; // com `quantidade`, é só o nome do setor; sem ela, é exibido como veio (ex.: "NOME (3)")
  quantidade?: number;
  setor?: string; // destino de um nome solto sobre o card; sem ele o card não aceita soltar
  acao: React.ReactNode;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(true);
  const [sobre, setSobre] = useState(false);
  const { ativo, adicionar } = useQuadranteDnd();
  const visual = setorVisual(setor ?? titulo);

  return (
    <div
      className={`mb-4 qd-surface overflow-hidden ${sobre ? "ring-2 ring-[var(--brass-bright)] border-transparent" : ""}`}
      onDragOver={(e) => {
        if (!ativo || !setor || !e.dataTransfer.types.includes(MIME_PESSOA)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setSobre(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false);
      }}
      onDrop={(e) => {
        setSobre(false);
        if (!ativo || !setor) return;
        const raw = e.dataTransfer.getData(MIME_PESSOA);
        if (!raw) return;
        e.preventDefault();
        try {
          const { pessoaId, nome } = JSON.parse(raw);
          if (typeof pessoaId === "number" && typeof nome === "string") adicionar(pessoaId, nome, setor);
        } catch {
          /* dado de arrastar inválido: ignora */
        }
      }}
    >
      <div className="flex items-center gap-2 pr-3 sm:pr-4">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="group flex flex-1 min-w-0 items-center gap-3 px-3 py-3 sm:px-4 text-left"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center text-[#8a92a8] transition-transform duration-200 group-hover:text-[var(--ink)] ${
              aberto ? "rotate-90" : ""
            }`}
          >
            <Icon name="chevron" className="h-4 w-4" />
          </span>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.cor}`}>
            <Icon name={visual.icone} className="h-[18px] w-[18px]" />
          </span>
          <span className="truncate text-[0.8125rem] font-semibold tracking-wide text-[var(--ink)]">{titulo}</span>
          {quantidade !== undefined && (
            <span className="shrink-0 rounded-full bg-[#eef1f8] px-2 py-0.5 font-[var(--font-plex-mono)] text-xs font-medium text-[var(--ink)]">
              {quantidade}
            </span>
          )}
        </button>
        {acao}
      </div>
      <div className="qd-collapse" data-open={aberto}>
        <div inert={!aberto}>
          <div className="border-t border-[#eef0f5]">{children}</div>
        </div>
      </div>
    </div>
  );
}
