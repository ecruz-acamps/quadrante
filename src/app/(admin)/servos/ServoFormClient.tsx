"use client";

import { useActionState, useState } from "react";
import { solicitarLiberacaoConflito } from "@/lib/actions";

type ConflitoState = {
  ok?: true;
  error?: string;
  conflito?: {
    pessoaId: number;
    missaoId: number;
    missaoConflitoNome: string;
    distancia: number;
  };
};

export default function ServoFormClient({
  action,
  pessoaNome,
  children,
}: {
  action: (prevState: unknown, formData: FormData) => Promise<ConflitoState | void>;
  pessoaNome: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    action as (s: ConflitoState | null | void, f: FormData) => Promise<ConflitoState | null | void>,
    null
  );
  const [solicitado, setSolicitado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ultimoConflito, setUltimoConflito] = useState(state?.conflito ?? null);
  const [prevStateConflito, setPrevStateConflito] = useState(state?.conflito ?? null);

  if (state?.conflito !== prevStateConflito) {
    setPrevStateConflito(state?.conflito ?? null);
    if (state?.conflito) setUltimoConflito(state.conflito);
  }

  const conflitoExibido = ultimoConflito ?? state?.conflito;

  async function solicitarLiberacao() {
    if (!conflitoExibido) return;
    await solicitarLiberacaoConflito(
      conflitoExibido.pessoaId,
      conflitoExibido.missaoId,
      pessoaNome,
      conflitoExibido.missaoConflitoNome,
      "esta missão"
    );
    setSolicitado(true);
  }

  return (
    <form action={formAction} className="card p-6 space-y-4">
      {children}
      {conflitoExibido && (
        <div className="border border-[var(--signal)] rounded p-3 text-sm space-y-2">
          <p>
            {pessoaNome} já é servo ativo em <strong>{conflitoExibido.missaoConflitoNome}</strong>, a{" "}
            {conflitoExibido.distancia} mês(es) de distância desta missão.
          </p>
          {!solicitado ? (
            <button type="button" onClick={solicitarLiberacao} className="btn-primary px-3 py-1 text-sm">
              Solicitar liberação da coordenação
            </button>
          ) : (
            <>
              <p className="text-[var(--ink-soft)]/70">
                Código enviado para a coordenação geral. Peça o código a eles e digite abaixo:
              </p>
              <input
                name="codigoLiberacao"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código de 6 dígitos"
                className="input"
              />
            </>
          )}
        </div>
      )}
      {state?.error && <p className="text-[var(--signal)] text-sm">{state.error}</p>}
      <button disabled={pending} className="btn-primary px-6 py-2">
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
