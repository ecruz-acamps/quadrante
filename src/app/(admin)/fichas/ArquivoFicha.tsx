"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sincronizarFichaAction } from "@/lib/actionsFichaArquivo";

const ACEITOS = ".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx";

type Props = {
  fichaId: number;
  nome: string | null; // nome do arquivo no OneDrive
  url: string | null;
  erro: string | null; // última falha ao sincronizar
  compacto?: boolean; // na linha da tabela
};

export default function ArquivoFicha({ fichaId, nome, url, erro, compacto }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; ruim: boolean } | null>(null);

  async function enviar(arquivo: File) {
    setEnviando(true);
    setMensagem(null);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const res = await fetch(`/api/fichas/${fichaId}/arquivo`, { method: "POST", body: corpo });
      const r = (await res.json().catch(() => ({ erro: "Resposta inesperada do servidor." }))) as { erro?: string; aviso?: string; nome?: string };
      if (r.erro) setMensagem({ texto: r.erro, ruim: true });
      else if (r.aviso) setMensagem({ texto: `Enviado, mas: ${r.aviso}`, ruim: true });
      else setMensagem({ texto: `Enviado como "${r.nome}".`, ruim: false });
      router.refresh();
    } catch {
      setMensagem({ texto: "Falha na conexão. Tente de novo.", ruim: true });
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  async function tentarDeNovo() {
    setEnviando(true);
    const r = await sincronizarFichaAction(fichaId).catch(() => ({ erro: "Falha na conexão." }));
    setMensagem(r.erro ? { texto: r.erro, ruim: true } : { texto: "Arquivo em dia no OneDrive.", ruim: false });
    setEnviando(false);
    router.refresh();
  }

  return (
    <div className={compacto ? "inline-flex flex-col items-end gap-1" : "space-y-2"}>
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
        <span className="inline-flex flex-wrap items-center gap-2 text-xs">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="underline text-[var(--ink)]" title="Abrir no OneDrive">
              {compacto ? "Ficha no OneDrive" : nome}
            </a>
          ) : (
            <span>{nome}</span>
          )}
          <button type="button" disabled={enviando} onClick={() => input.current?.click()} className="btn-link text-xs">
            {enviando ? "Enviando…" : "Trocar arquivo"}
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={enviando}
          onClick={() => input.current?.click()}
          className={compacto ? "btn-link text-xs" : "btn-primary px-4 py-2 text-sm"}
        >
          {enviando ? "Enviando…" : "Fazer upload da ficha preenchida"}
        </button>
      )}
      {erro && !mensagem && (
        <span className="block text-xs text-[var(--signal)]" title={erro}>
          ⚠ Fora de ordem no OneDrive.{" "}
          <button type="button" disabled={enviando} onClick={tentarDeNovo} className="underline">
            Tentar de novo
          </button>
        </span>
      )}
      {mensagem && <span className={`block text-xs ${mensagem.ruim ? "text-[var(--signal)]" : "text-green-700"}`}>{mensagem.texto}</span>}
    </div>
  );
}
