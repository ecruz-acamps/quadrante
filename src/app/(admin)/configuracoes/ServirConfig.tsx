"use client";

import { useState, useTransition } from "react";
import { definirServirConfig } from "@/lib/actionsServir";

export default function ServirConfig({
  missaoId,
  slug,
  servirPublicado,
  servirDatas,
}: {
  missaoId: number;
  slug: string;
  servirPublicado: boolean;
  servirDatas: string | null;
}) {
  const [publicado, setPublicado] = useState(servirPublicado);
  const [datas, setDatas] = useState(servirDatas ?? "");
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();
  const caminho = `/servir/${slug}`;

  function salvar(novoPublicado: boolean) {
    setPublicado(novoPublicado);
    startTransition(() => definirServirConfig(missaoId, novoPublicado, datas));
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${caminho}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o link continua visível */
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium">Datas da missão (aparecem na pergunta “Você pode servir…?”)</span>
        <input
          value={datas}
          onChange={(e) => setDatas(e.target.value)}
          onBlur={() => startTransition(() => definirServirConfig(missaoId, publicado, datas))}
          maxLength={80}
          placeholder="26 a 30 de dezembro"
          className="input mt-1"
        />
      </label>
      <p className="text-xs text-[var(--ink-soft)]/60">
        Status: {publicado ? "recebendo candidaturas" : "fechado"} · link: <code>{caminho}</code>
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => salvar(!publicado)}
          className={`inline-block rounded px-4 py-2 font-medium ${
            publicado
              ? "bg-[var(--signal)]/10 border border-[var(--signal)]/30 text-[var(--signal)]"
              : "bg-[var(--brass)] text-[var(--ink)]"
          }`}
        >
          {publicado ? "Fechar candidaturas" : "Abrir candidaturas"}
        </button>
        <button type="button" onClick={copiar} className="btn-link px-3 py-2">
          {copiado ? "Link copiado" : "Copiar link"}
        </button>
        <a href="/candidatos" className="btn-link px-3 py-2">
          Ver candidatos
        </a>
        <a href="/configuracoes/perguntas-servir" className="btn-link px-3 py-2">
          Editar perguntas
        </a>
      </div>
    </div>
  );
}
