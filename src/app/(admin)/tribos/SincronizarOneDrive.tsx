"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sincronizarMissaoAction } from "@/lib/actionsFichaArquivo";

// Confere de novo todas as fichas preenchidas da missão no OneDrive: nomes e cópias nas pastas das tribos.
export default function SincronizarOneDrive({ missaoId, comArquivo, comErro }: { missaoId: number; comArquivo: number; comErro: number }) {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; ruim: boolean } | null>(null);
  if (comArquivo === 0) return null;

  async function sincronizar() {
    setRodando(true);
    setMsg(null);
    const r = await sincronizarMissaoAction(missaoId).catch(() => ({ erro: "Falha na conexão.", total: 0, falhas: 0 }));
    if (r.erro) setMsg({ texto: r.erro, ruim: true });
    else if (r.falhas) setMsg({ texto: `${r.falhas} de ${r.total} fichas ainda com problema (veja em Fichas).`, ruim: true });
    else setMsg({ texto: `${r.total} fichas em dia no OneDrive.`, ruim: false });
    setRodando(false);
    router.refresh();
  }

  return (
    <div className="card p-4 mb-6 flex flex-wrap items-center gap-3 text-sm">
      <span className="flex-1 min-w-[12rem] text-[var(--ink-soft)]">
        {comArquivo} {comArquivo === 1 ? "ficha preenchida" : "fichas preenchidas"} no OneDrive. Depois do sorteio e de cada troca, as cópias
        vão para a pasta da cor da tribo.
        {comErro > 0 && <strong className="text-[var(--signal)]"> {comErro} fora de ordem.</strong>}
      </span>
      <button type="button" onClick={sincronizar} disabled={rodando} className="rounded px-3 py-1.5 border border-[var(--line)] text-[var(--ink)]">
        {rodando ? "Conferindo…" : "Sincronizar com o OneDrive"}
      </button>
      {msg && <span className={`w-full text-xs ${msg.ruim ? "text-[var(--signal)]" : "text-green-700"}`}>{msg.texto}</span>}
    </div>
  );
}
