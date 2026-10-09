"use client";

import { useActionState, useRef, useState } from "react";
import { inscreverCerco, sugerirNomesCerco } from "@/lib/actions";
import { HORARIOS_CERCO } from "@/lib/constants";
import { textoComprovante, linkWhatsApp, formatarRegistro, type DadosComprovante } from "@/lib/cercoComprovante";

function Comprovante({ dados, onAlterar }: { dados: DadosComprovante; onAlterar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = textoComprovante(dados);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem permissão de área de transferência: o botão do WhatsApp continua disponível */
    }
  }

  return (
    <div className="card p-6 space-y-5" role="status">
      <div className="text-center">
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--brass)]">Inscrição confirmada</p>
        <h2 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mt-1">Obrigado por servir!</h2>
      </div>

      <dl className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] text-sm">
        {[
          ["Nome", dados.nome],
          ["Setor", dados.setor],
          ["Hora de adoração", dados.horario],
          ["Missão", dados.missao],
          ["Registrado em", formatarRegistro(dados.registradoEm)],
        ]
          .filter(([, valor]) => valor)
          .map(([rotulo, valor]) => (
            <div key={rotulo} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <dt className="text-[var(--ink-soft)]/70">{rotulo}</dt>
              <dd className="text-right font-medium text-[var(--ink)]">{valor}</dd>
            </div>
          ))}
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={linkWhatsApp(texto)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 py-2.5 text-center"
        >
          Enviar pelo WhatsApp
        </a>
        <button type="button" onClick={copiar} className="btn-link flex-1 py-2.5 text-center">
          {copiado ? "Copiado!" : "Copiar comprovante"}
        </button>
      </div>

      <button type="button" onClick={onAlterar} className="w-full text-center text-sm text-[var(--ink-soft)]/80 underline">
        Quero trocar meu horário
      </button>
    </div>
  );
}

export default function CercoForm({
  missaoId,
  maxPorHorario,
  ocupados,
}: {
  missaoId: number;
  maxPorHorario: number;
  ocupados: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(inscreverCerco, null);
  const [horario, setHorario] = useState("");
  const [nome, setNome] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  // resultado cujo comprovante a pessoa já dispensou ("Quero trocar meu horário"); um resultado novo sempre aparece
  const [dispensado, setDispensado] = useState<typeof state>(null);
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

  if (state && "ok" in state && state.ok && state !== dispensado) {
    return <Comprovante dados={state.comprovante} onAlterar={() => setDispensado(state)} />;
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
        <span className="mt-1 block text-xs text-[var(--ink-soft)]/60">Seu setor é preenchido automaticamente pelo seu cadastro.</span>
      </label>

      <div>
        <p className="text-sm text-[var(--ink)] font-medium mb-2">
          Escolha sua hora de adoração{" "}
          <span className="text-[var(--ink-soft)]/60 font-normal">(máx. {maxPorHorario} pessoas por horário)</span>
        </p>
        {HORARIOS_CERCO.every((h) => (ocupados[h] || 0) >= maxPorHorario) ? (
          <p className="text-sm text-[var(--signal)]">Todos os horários já estão lotados.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
            {HORARIOS_CERCO.filter((h) => (ocupados[h] || 0) < maxPorHorario).map((h) => {
              const qtd = ocupados[h] || 0;
              const selecionado = horario === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorario(h)}
                  className={`rounded px-2 py-1 flex flex-col items-center text-xs border transition-colors ${
                    selecionado
                      ? "bg-[var(--brass-bright)] border-[var(--brass-bright)] text-[var(--ink)]"
                      : "bg-[var(--card)] border-[var(--line)] text-[var(--ink)]"
                  }`}
                >
                  <span className="font-medium">{h}</span>
                  <span className="font-mono text-[0.65rem] opacity-70">
                    {qtd}/{maxPorHorario}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {state && "error" in state && state.error && (
        <p role="alert" className="text-[var(--signal)] text-sm">
          {state.error}
        </p>
      )}

      <button disabled={pending || !horario} className="btn-primary w-full py-2.5">
        {pending ? "Enviando..." : "Confirmar horário"}
      </button>
    </form>
  );
}
