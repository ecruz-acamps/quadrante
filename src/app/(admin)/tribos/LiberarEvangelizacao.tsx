"use client";

import { useState } from "react";
import { liberarEvangelizacaoAction } from "./actionsLiberacao";

type Props = { missaoId: number; liberadaEm: string | null; liberadaPor: string | null };

export default function LiberarEvangelizacao({ missaoId, liberadaEm, liberadaPor }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function mudar(liberar: boolean) {
    const pergunta = liberar
      ? "Confirmar QUADRANTE OK?\n\nA Evangelização passa a poder baixar as fichas preenchidas separadas por tribo."
      : "Desfazer a liberação? A Evangelização deixa de poder baixar as fichas até você liberar de novo.";
    if (!window.confirm(pergunta)) return;
    setOcupado(true);
    setErro(null);
    const r = await liberarEvangelizacaoAction(missaoId, liberar).catch(() => ({ erro: "Falha na conexão." }));
    if (r.erro) setErro(r.erro);
    setOcupado(false);
  }

  const quando = liberadaEm
    ? new Date(liberadaEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : null;

  return (
    <div className={`card p-4 mb-6 flex flex-wrap items-center gap-3 text-sm ${liberadaEm ? "border border-green-700/30" : ""}`}>
      {liberadaEm ? (
        <>
          <span className="flex-1 min-w-[14rem] text-green-800">
            ✓ <strong>Liberado para a Evangelização</strong> em {quando}
            {liberadaPor ? ` por ${liberadaPor}` : ""}. Ela já pode baixar as fichas separadas por tribo.
          </span>
          <button type="button" disabled={ocupado} onClick={() => mudar(false)} className="btn-link text-xs">
            Desfazer liberação
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 min-w-[14rem] text-[var(--ink-soft)]">
            Quando as tribos estiverem prontas, libere para a Evangelização baixar as fichas preenchidas separadas por tribo.
          </span>
          <button type="button" disabled={ocupado} onClick={() => mudar(true)} className="btn-primary px-4 py-2 text-sm">
            {ocupado ? "Liberando…" : "QUADRANTE OK - Liberar Evangelização"}
          </button>
        </>
      )}
      {erro && <span className="w-full text-xs text-[var(--signal)]">{erro}</span>}
    </div>
  );
}
