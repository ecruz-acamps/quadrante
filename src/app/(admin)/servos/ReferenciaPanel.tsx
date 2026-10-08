"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MIME_PESSOA, useQuadranteDnd } from "./QuadranteDnd";

export type ServoRef = {
  id: number;
  pessoaId: number;
  nome: string;
  setor: string;
  funcao: string;
  status: string; // ATIVO | DESISTIU | RECUSOU
  motivo: string | null;
};

const ROTULO_STATUS: Record<string, string> = { ATIVO: "Ativos", DESISTIU: "Desistiram", RECUSOU: "Recusaram" };

// Painel somente leitura com o quadrante de outra edição. Os nomes podem ser arrastados
// para um setor do quadrante atual (ou adicionados com o botão "+", que funciona em toque).
export default function ReferenciaPanel({
  missoes,
  refId,
  servos,
  setores,
  pessoasNoQuadrante,
}: {
  missoes: { id: number; nome: string }[];
  refId: number;
  servos: ServoRef[];
  setores: string[]; // ordem dos setores
  pessoasNoQuadrante: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { adicionar } = useQuadranteDnd();
  const [busca, setBusca] = useState("");
  const [setorFiltro, setSetorFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  const jaNoQuadrante = useMemo(() => new Set(pessoasNoQuadrante), [pessoasNoQuadrante]);

  function navegar(ref: string | null) {
    const p = new URLSearchParams(params.toString());
    if (ref) p.set("ref", ref);
    else p.delete("ref");
    router.push(`${pathname}${p.size ? `?${p}` : ""}`);
  }

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const mapa = new Map<string, ServoRef[]>();
    for (const s of servos) {
      if (setorFiltro && s.setor !== setorFiltro) continue;
      if (statusFiltro && s.status !== statusFiltro) continue;
      if (termo && !s.nome.toLowerCase().includes(termo)) continue;
      if (!mapa.has(s.setor)) mapa.set(s.setor, []);
      mapa.get(s.setor)!.push(s);
    }
    const ordem = (n: string) => {
      const i = setores.indexOf(n);
      return i === -1 ? setores.length : i;
    };
    return [...mapa.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]) || a[0].localeCompare(b[0]));
  }, [servos, busca, setorFiltro, statusFiltro, setores]);

  const setoresPresentes = useMemo(() => [...new Set(servos.map((s) => s.setor))].sort(), [servos]);

  return (
    <aside className="card flex flex-col min-h-0 h-full" aria-label="Quadrante de referência">
      <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2 flex items-center justify-between gap-2 rounded-t">
        <span className="font-medium text-sm">Edição de referência</span>
        <button type="button" onClick={() => navegar(null)} className="text-xs hover:underline">
          Fechar ×
        </button>
      </div>

      <div className="p-3 space-y-2 border-b border-[var(--line)]">
        <select value={refId} onChange={(e) => navegar(e.target.value)} className="input text-sm w-full" aria-label="Missão de referência">
          {missoes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome" className="input text-sm w-full" />
        <div className="flex gap-2">
          <select value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value)} className="input text-sm flex-1 min-w-0" aria-label="Setor">
            <option value="">Todos os setores</option>
            {setoresPresentes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="input text-sm flex-1 min-w-0" aria-label="Situação">
            <option value="">Todos</option>
            {Object.entries(ROTULO_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-[var(--ink-soft)]/70">Arraste um nome para um setor do quadrante ao lado, ou use “+”.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {grupos.length === 0 && <p className="p-4 text-sm text-[var(--ink-soft)]/60">Nenhum servo encontrado.</p>}
        {grupos.map(([setor, lista]) => {
          const aberto = !fechados.has(setor);
          return (
            <section key={setor}>
              <button
                type="button"
                onClick={() =>
                  setFechados((prev) => {
                    const n = new Set(prev);
                    if (n.has(setor)) n.delete(setor);
                    else n.add(setor);
                    return n;
                  })
                }
                className="w-full flex items-center gap-2 px-4 py-1.5 text-xs font-medium bg-[var(--paper)] text-[var(--ink-soft)] border-y border-[var(--line)] hover:opacity-80"
              >
                <span className={`inline-block transition-transform ${aberto ? "rotate-90" : ""}`}>▶</span>
                {setor} ({lista.length})
              </button>
              {aberto && (
                <ul className="divide-y divide-[var(--line)]">
                  {lista.map((s) => {
                    const ja = jaNoQuadrante.has(s.pessoaId);
                    return (
                      <li
                        key={s.id}
                        draggable={!ja}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(MIME_PESSOA, JSON.stringify({ pessoaId: s.pessoaId, nome: s.nome }));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className={`flex items-center gap-2 px-4 py-1.5 text-sm ${
                          ja ? "opacity-45" : "cursor-grab active:cursor-grabbing hover:bg-[var(--paper)]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{s.nome}</div>
                          <div className="text-[0.7rem] text-[var(--ink-soft)]/70 flex flex-wrap gap-x-2">
                            {s.funcao !== "INTEGRANTE" && <span>{s.funcao.toLowerCase()}</span>}
                            {s.status !== "ATIVO" && (
                              <span className="text-[var(--signal)]" title={s.motivo ?? undefined}>
                                {s.status === "DESISTIU" ? "desistiu" : "recusou"}
                                {s.motivo ? ` — ${s.motivo}` : ""}
                              </span>
                            )}
                            {ja && <span>já no quadrante</span>}
                          </div>
                        </div>
                        {!ja && (
                          <button
                            type="button"
                            onClick={() => adicionar(s.pessoaId, s.nome, s.setor)}
                            aria-label={`Adicionar ${s.nome} em ${s.setor}`}
                            title={`Adicionar em ${s.setor}`}
                            className="shrink-0 w-6 h-6 rounded border border-[var(--brass)]/50 text-[var(--brass)] hover:bg-[var(--brass)]/10 leading-none"
                          >
                            +
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
