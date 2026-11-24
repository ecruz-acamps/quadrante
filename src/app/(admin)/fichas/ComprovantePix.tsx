"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removerComprovanteAction } from "@/lib/actionsFichaArquivo";
import { lerResposta } from "./respostaServidor";

const ACEITOS = ".pdf,.jpg,.jpeg,.png,.heic,.webp";

// Quadro "Comprovante do PIX" na página da ficha: enviar, abrir, trocar ou remover.
export default function ComprovantePix({ fichaId, nome, url, situacao }: { fichaId: number; nome: string | null; url: string | null; situacao: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ texto: string; ruim: boolean } | null>(null);

  async function enviar(arquivo: File) {
    setOcupado("Enviando…");
    setMsg(null);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const res = await fetch(`/api/fichas/${fichaId}/comprovante`, { method: "POST", body: corpo });
      const r = await lerResposta<{ erro?: string }>(res);
      setMsg(r.erro ? { texto: r.erro, ruim: true } : { texto: "Comprovante enviado. Agora a ficha pode ser marcada como OK - PAGO (abaixo) e salva.", ruim: false });
    } catch {
      setMsg({ texto: "Falha na conexão. Tente de novo.", ruim: true });
    }
    setOcupado(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function remover() {
    if (!window.confirm("Remover o comprovante? Ele vai para a lixeira do OneDrive e a ficha volta para PENDENTE.")) return;
    setOcupado("Removendo…");
    const r = await removerComprovanteAction(fichaId).catch(() => ({ erro: "Falha na conexão." }));
    setMsg(r.erro ? { texto: r.erro, ruim: true } : { texto: "Comprovante removido; a ficha voltou para PENDENTE.", ruim: false });
    setOcupado(null);
    router.refresh();
  }

  return (
    <div id="comprovante" className="card p-4 mb-6 space-y-2 scroll-mt-4">
      <h2 className="font-medium text-[var(--ink)]">Comprovante do PIX</h2>
      <input
        ref={input}
        type="file"
        accept={ACEITOS}
        className="hidden"
        onChange={(e) => {
          const a = e.target.files?.[0];
          if (a) enviar(a);
        }}
      />
      {nome ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="underline text-[var(--ink)]">
              {nome}
            </a>
          ) : (
            <span>{nome}</span>
          )}
          <button type="button" disabled={Boolean(ocupado)} onClick={() => input.current?.click()} className="btn-link text-xs">
            {ocupado ?? "Trocar"}
          </button>
          <button type="button" disabled={Boolean(ocupado)} onClick={remover} className="btn-danger-link text-xs">
            Remover
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--ink-soft)]/80">
            Sem o comprovante, a ficha fica <strong>PENDENTE</strong> e não pode ser marcada como <strong>OK - PAGO</strong>.
          </p>
          <button type="button" disabled={Boolean(ocupado)} onClick={() => input.current?.click()} className="btn-primary px-4 py-2 text-sm">
            {ocupado ?? "Enviar comprovante do PIX"}
          </button>
        </>
      )}
      {nome && situacao !== "OK" && !msg && (
        <p className="text-xs text-[var(--ink-soft)]/80">Comprovante enviado: a ficha já pode ser marcada como OK - PAGO (abaixo) e salva.</p>
      )}
      {msg && <p className={`text-xs ${msg.ruim ? "text-[var(--signal)]" : "text-green-700"}`}>{msg.texto}</p>}
    </div>
  );
}
