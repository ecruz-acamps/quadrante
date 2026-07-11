"use client";

import { useRef, useState } from "react";
import { buscarPessoas } from "@/lib/actions";

type Sugestao = Awaited<ReturnType<typeof buscarPessoas>>[number];

export default function ServoBusca({
  missaoId,
  nome,
  onChangeNome,
  onSelecionar,
}: {
  missaoId: number;
  nome: string;
  onChangeNome: (nome: string) => void;
  onSelecionar: (pessoa: Sugestao) => void;
}) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(valor: string) {
    onChangeNome(valor);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const resultado = await buscarPessoas(missaoId, valor);
      setSugestoes(resultado);
      setAberto(resultado.length > 0);
    }, 300);
  }

  function selecionar(p: Sugestao) {
    onSelecionar(p);
    setAberto(false);
    setSugestoes([]);
  }

  return (
    <div className="relative">
      <input
        name="nome"
        required
        value={nome}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setAberto(sugestoes.length > 0)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        autoComplete="off"
        className="input"
      />
      {aberto && (
        <ul className="card absolute z-10 mt-1 w-full max-h-64 overflow-auto p-1">
          {sugestoes.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={() => selecionar(p)}
                className="w-full text-left px-3 py-2 rounded hover:bg-[var(--paper)]"
              >
                <div className="text-sm font-medium">{p.nome}</div>
                <div className="text-xs text-[var(--ink-soft)]">
                  {[p.setor, p.cidade].filter(Boolean).join(" · ") || "sem histórico de servo"}
                </div>
                {p.repeticoesNoSetor >= 2 && (
                  <div className="text-xs text-[var(--signal)] mt-0.5">
                    Já serviu {p.repeticoesNoSetor}x em {p.setor}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
