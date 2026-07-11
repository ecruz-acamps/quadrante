"use client";

import { useActionState, useRef, useState } from "react";
import { inscreverCerco, sugerirNomesCerco } from "@/lib/actions";
import { HORARIOS_CERCO } from "@/lib/constants";

const MAX_POR_HORARIO = 15;

export default function CercoForm({
  missaoId,
  setores,
  ocupados,
}: {
  missaoId: number;
  setores: string[];
  ocupados: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(inscreverCerco, null);
  const [horario, setHorario] = useState("");
  const [nome, setNome] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChangeNome(valor: string) {
    setNome(valor);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const resultado = await sugerirNomesCerco(missaoId, valor);
      setSugestoes(resultado);
      setMostrarSugestoes(resultado.length > 0);
    }, 300);
  }

  function selecionarNome(n: string) {
    setNome(n);
    setMostrarSugestoes(false);
    setSugestoes([]);
  }

  return (
    <form action={action} className="card p-6 space-y-6">
      <input type="hidden" name="missaoId" value={missaoId} />
      <input type="hidden" name="horario" value={horario} />

      <label className="block text-sm">
        <span className="text-[var(--ink)] font-medium">Seu nome</span>
        <div className="relative">
          <input
            name="nome"
            required
            value={nome}
            onChange={(e) => handleChangeNome(e.target.value)}
            onFocus={() => setMostrarSugestoes(sugestoes.length > 0)}
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
            placeholder="Digite seu nome completo"
            autoComplete="off"
            className="input mt-1"
          />
          {mostrarSugestoes && (
            <ul className="card absolute z-10 mt-1 w-full max-h-48 overflow-auto p-1">
              {sugestoes.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    onMouseDown={() => selecionarNome(n)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[var(--paper)] text-sm"
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </label>

      <label className="block text-sm">
        <span className="text-[var(--ink)] font-medium">Seu setor</span>
        <select name="setor" required className="input mt-1">
          <option value="">Selecione seu setor...</option>
          {setores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="text-sm text-[var(--ink)] font-medium mb-2">
          Escolha sua hora de adoração{" "}
          <span className="text-[var(--ink-soft)]/60 font-normal">(máx. {MAX_POR_HORARIO} pessoas por horário)</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {HORARIOS_CERCO.map((h) => {
            const qtd = ocupados[h] || 0;
            const cheio = qtd >= MAX_POR_HORARIO;
            const selecionado = horario === h;
            return (
              <button
                key={h}
                type="button"
                disabled={cheio}
                onClick={() => setHorario(h)}
                className={`rounded px-3 py-2 flex justify-between text-sm border transition-colors ${
                  selecionado
                    ? "bg-[var(--brass-bright)] border-[var(--brass-bright)] text-[var(--ink)]"
                    : cheio
                    ? "bg-[var(--signal)]/10 border-[var(--signal)]/30 text-[var(--signal)] cursor-not-allowed"
                    : "bg-[var(--card)] border-[var(--line)] text-[var(--ink)]"
                }`}
              >
                <span>{h}</span>
                <span className="font-mono font-semibold">
                  {qtd}/{MAX_POR_HORARIO}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {state && "error" in state && state.error && (
        <p className="text-[var(--signal)] text-sm">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-[var(--brass)] text-sm font-medium">
          Inscrição confirmada! Obrigado por servir.
        </p>
      )}

      <button disabled={pending || !horario} className="btn-primary w-full py-2.5">
        {pending ? "Enviando..." : "Confirmar horário"}
      </button>
    </form>
  );
}
