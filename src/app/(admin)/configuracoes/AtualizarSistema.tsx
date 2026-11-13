"use client";

import { useEffect, useRef, useState } from "react";
import type { Disponivel, StatusAtualizacao } from "@/lib/atualizacaoSistema";
import {
  aplicarAtualizacaoAction,
  iniciarAtualizacaoAction,
  statusAtualizacaoAction,
  verificarDisponivelAction,
} from "./actionsAtualizacao";

const ROTULO = {
  parado: "nenhuma atualização em andamento",
  rodando: "preparando a versão nova (o sistema continua no ar)…",
  concluido: "concluída",
  falhou: "falhou (o sistema continua na versão anterior)",
} as const;

function haQuanto(ms: number | null) {
  if (!ms) return "nunca";
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dia(s)`;
}

// espera o app voltar com outra versão e recarrega a página (o código da tela também mudou)
async function esperarVersaoNova(anterior: string | null) {
  for (let i = 0; i < 90; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    try {
      const r = await fetch("/api/versao", { cache: "no-store" });
      if (r.ok) {
        const { versao } = (await r.json()) as { versao: string | null };
        if (versao && versao !== anterior) break;
      }
    } catch {
      // reiniciando
    }
  }
  window.location.reload();
}

export default function AtualizarSistema({ inicial, disponivel: dispInicial }: { inicial: StatusAtualizacao; disponivel: Disponivel }) {
  const [status, setStatus] = useState(inicial);
  const [disp, setDisp] = useState(dispInicial);
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const versaoAntes = useRef(inicial.versao);
  const esperando = useRef(false);
  const logRef = useRef<HTMLPreElement>(null);

  function aguardarReinicio(anterior: string | null) {
    if (esperando.current) return;
    esperando.current = true;
    setTrocando(true);
    esperarVersaoNova(anterior);
  }

  // enquanto prepara, consulta a cada 3 s. Quem diz que a versão nova entrou no ar é /api/versao: depois do
  // reinício as Server Actions desta página (do build antigo) deixam de existir no servidor.
  const rodandoAgora = status.estado === "rodando";
  useEffect(() => {
    if (!rodandoAgora) return;
    const t = setInterval(async () => {
      if (esperando.current) return;
      try {
        const r = await fetch("/api/versao", { cache: "no-store" });
        if (r.ok) {
          const { versao } = (await r.json()) as { versao: string | null };
          if (versao && versao !== versaoAntes.current) return window.location.reload();
        }
      } catch {
        // reiniciando
      }
      try {
        const s = await statusAtualizacaoAction();
        if (s.versao && s.versao !== versaoAntes.current) return window.location.reload();
        setStatus(s);
        if (s.estado === "concluido" && s.pronto) aguardarReinicio(versaoAntes.current);
      } catch {
        // servidor ocupado compilando ou reiniciando; tenta no próximo ciclo
      }
    }, 3000);
    return () => clearInterval(t);
  }, [rodandoAgora]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status.log]);

  async function verificar() {
    setErro("");
    setVerificando(true);
    try {
      setDisp(await verificarDisponivelAction());
    } catch {
      setErro("Não foi possível verificar agora.");
    }
    setVerificando(false);
  }

  async function atualizar() {
    if (
      !window.confirm(
        "Atualizar o sistema agora?\n\nO sistema continua funcionando enquanto a versão nova é preparada (alguns minutos). No fim ele reinicia sozinho e fica fora do ar só alguns segundos.",
      )
    )
      return;
    setErro("");
    versaoAntes.current = status.versao;
    const r = await iniciarAtualizacaoAction();
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setStatus(await statusAtualizacaoAction());
  }

  async function aplicar() {
    setErro("");
    setTrocando(true);
    const r = await aplicarAtualizacaoAction().catch(() => ({ erro: "Não foi possível aplicar." }));
    if (r.erro) {
      setErro(r.erro);
      setTrocando(false);
      return;
    }
    aguardarReinicio(status.versao);
  }

  const rodando = status.estado === "rodando";
  const temNova = disp.quantidade > 0;
  return (
    <div className="card p-4 space-y-3">
      {temNova && !rodando && !trocando && (
        <div className="rounded-lg border border-[var(--brass)]/50 bg-[var(--brass)]/10 p-3">
          <p className="text-sm font-medium text-[var(--ink)]">
            Nova versão disponível: {disp.quantidade} {disp.quantidade === 1 ? "alteração" : "alterações"}
          </p>
          {disp.alteracoes.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-[var(--ink-soft)]/90 space-y-0.5">
              {disp.alteracoes.map((a) => (
                <li key={a.hash}>{a.titulo || a.hash}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-sm text-[var(--ink-soft)]/80">
        Versão no ar: <strong>{status.versao ?? "desconhecida"}</strong> · Situação:{" "}
        <strong>{trocando ? "trocando a versão e reiniciando (alguns segundos)…" : ROTULO[status.estado]}</strong>
      </p>
      <p className="text-xs text-[var(--ink-soft)]/70">
        {temNova ? "" : "O sistema está na versão mais recente. "}Verificado {haQuanto(disp.verificadoEm)}
        {disp.erro ? ` · ${disp.erro}` : ""}. O sistema confere o GitHub sozinho a cada 30 minutos.
      </p>
      <p className="text-xs text-[var(--ink-soft)]/70">
        A atualização faz uma cópia do banco, baixa o código novo e compila numa pasta separada, sem tirar o sistema do ar. No fim
        troca a versão e reinicia sozinho (alguns segundos). Se algo falhar, nada muda. Mudança de porta ou do pm2 exige acesso ao
        servidor.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={atualizar} disabled={rodando || trocando} className="btn-primary px-4 py-2">
          {rodando ? "Atualizando…" : temNova ? "Atualizar agora" : "Atualizar o sistema"}
        </button>
        <button
          type="button"
          onClick={verificar}
          disabled={verificando || rodando || trocando}
          className="rounded px-4 py-2 border border-[var(--line)] text-[var(--ink)]"
        >
          {verificando ? "Verificando…" : "Verificar agora"}
        </button>
        {status.pronto && !rodando && !trocando && (
          <button type="button" onClick={aplicar} className="rounded px-4 py-2 border border-[var(--brass)] text-[var(--ink)] font-medium">
            Aplicar versão pronta
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
