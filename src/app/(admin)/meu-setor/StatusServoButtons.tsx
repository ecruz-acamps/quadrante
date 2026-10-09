"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarStatusServo } from "@/lib/actions";

type Status = "ATIVO" | "RECUSOU" | "DESISTIU";

const BOTOES: { status: Status; rotulo: string; pergunta: string | null; ativo: string }[] = [
  { status: "ATIVO", rotulo: "Sim", pergunta: null, ativo: "bg-green-600/10 border-green-600 text-green-700" },
  { status: "RECUSOU", rotulo: "Não", pergunta: "Por que a pessoa não vai servir?", ativo: "bg-[var(--signal)]/10 border-[var(--signal)] text-[var(--signal)]" },
  { status: "DESISTIU", rotulo: "Desistiu", pergunta: "Por que a pessoa desistiu?", ativo: "bg-[var(--signal)]/10 border-[var(--signal)] text-[var(--signal)]" },
];

export default function StatusServoButtons({ servoId, status, motivo }: { servoId: number; status: string; motivo: string | null }) {
  const router = useRouter();
  const [pedindo, setPedindo] = useState<Status | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function gravar(novo: Status, motivoTexto?: string) {
    setEnviando(true);
    setErro("");
    try {
      const r = await marcarStatusServo(servoId, novo, motivoTexto);
      if (r.error) {
        setErro(r.error);
        return;
      }
      fechar();
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  function fechar() {
    setPedindo(null);
    setTexto("");
    setErro("");
  }

  const pergunta = BOTOES.find((b) => b.status === pedindo)?.pergunta;

  return (
    <div>
      <div className="flex items-center gap-1">
        {BOTOES.map((b) => (
          <button
            key={b.status}
            type="button"
            disabled={enviando}
            onClick={() => (b.pergunta ? setPedindo(b.status) : gravar(b.status))}
            className={`px-2 py-1 text-xs rounded border ${
              status === b.status ? b.ativo : "border-[var(--line)] text-[var(--ink-soft)]/70 hover:border-[var(--ink)]"
            }`}
          >
            {b.rotulo}
          </button>
        ))}
      </div>
      {status !== "ATIVO" && motivo && <p className="mt-1 text-xs text-[var(--ink-soft)]/70">{motivo}</p>}
      {erro && !pedindo && <p className="mt-1 text-xs text-[var(--signal)]">{erro}</p>}

      {pedindo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fechar();
          }}
        >
          <div className="card w-full max-w-sm p-5 space-y-4">
            <p className="text-sm text-[var(--ink)]">{pergunta}</p>
            <textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Motivo (opcional)"
              rows={3}
              maxLength={500}
              className="input w-full"
            />
            {erro && (
              <p role="alert" className="text-sm text-[var(--signal)]">
                {erro}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={fechar} className="btn-link text-sm">
                Cancelar
              </button>
              <button type="button" onClick={() => gravar(pedindo, texto)} disabled={enviando} className="btn-primary px-4 py-1.5 text-sm">
                {enviando ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
