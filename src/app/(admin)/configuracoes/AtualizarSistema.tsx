"use client";

import { useEffect, useRef, useState } from "react";
import type { StatusAtualizacao } from "@/lib/atualizacaoSistema";
import { iniciarAtualizacaoAction, reiniciarSistemaAction, statusAtualizacaoAction } from "./actionsAtualizacao";

const ROTULO = { parado: "nenhuma atualização em andamento", rodando: "atualizando…", concluido: "pronto para reiniciar", falhou: "falhou" } as const;

export default function AtualizarSistema({ inicial }: { inicial: StatusAtualizacao }) {
  const [status, setStatus] = useState(inicial);
  const [erro, setErro] = useState("");
  const [reiniciando, setReiniciando] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  // enquanto roda, consulta o registro a cada 3 s
  useEffect(() => {
    if (status.estado !== "rodando") return;
    const t = setInterval(async () => {
      try {
        setStatus(await statusAtualizacaoAction());
      } catch {
        // o servidor pode estar ocupado compilando; tenta de novo no próximo ciclo
      }
    }, 3000);
    return () => clearInterval(t);
  }, [status.estado]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status.log]);

  async function atualizar() {
    if (!window.confirm("Atualizar o sistema agora? O sistema pode ficar lento durante a compilação e será reiniciado ao final.")) return;
    setErro("");
    const r = await iniciarAtualizacaoAction();
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setStatus(await statusAtualizacaoAction());
  }

  async function reiniciar() {
    setErro("");
    setReiniciando(true);
    const r = await reiniciarSistemaAction().catch(() => ({ erro: "Não foi possível reiniciar." }));
    if (r.erro) {
      setErro(r.erro);
      setReiniciando(false);
      return;
    }
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      try {
        if ((await fetch("/login", { cache: "no-store" })).ok) break;
      } catch {
        // ainda reiniciando
      }
    }
    window.location.reload();
  }

  const rodando = status.estado === "rodando";
  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm text-[var(--ink-soft)]/80">
        Versão instalada: <strong>{status.versao ?? "desconhecida"}</strong> · Situação: <strong>{ROTULO[status.estado]}</strong>
      </p>
      <p className="text-xs text-[var(--ink-soft)]/70">
        Baixa o código novo, faz uma cópia do banco, atualiza e compila. Só reinicia quando você pedir. Mudança de porta ou do pm2 exige
        acesso ao servidor.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={atualizar} disabled={rodando || reiniciando} className="btn-primary px-4 py-2">
          {rodando ? "Atualizando…" : "Atualizar o sistema"}
        </button>
        {status.estado === "concluido" && (
          <button type="button" onClick={reiniciar} disabled={reiniciando} className="rounded px-4 py-2 border border-[var(--brass)] text-[var(--ink)] font-medium">
            {reiniciando ? "Reiniciando…" : "Reiniciar agora"}
          </button>
        )}
      </div>
      {erro && <p className="text-sm text-[var(--signal)]">{erro}</p>}
      {status.log && (
        <pre ref={logRef} className="max-h-64 overflow-auto rounded bg-[var(--paper)] p-3 text-xs whitespace-pre-wrap">
          {status.log}
        </pre>
      )}
    </div>
  );
}
