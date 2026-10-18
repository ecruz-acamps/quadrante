"use client";

import { useState, useTransition } from "react";
import { associarApelidoCidade, criarCidadeDeGrafia, removerApelidoCidade, salvarVizinhanca } from "@/lib/actionsEvangelizacao";

type Cidade = { id: number; nome: string };

export function AssociarApelido({ texto, cidades }: { texto: string; cidades: Cidade[] }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [cidadeId, setCidadeId] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        className="text-xs border border-[var(--line)] rounded px-1 py-0.5 bg-[var(--card)]"
        value={cidadeId}
        onChange={(e) => setCidadeId(e.target.value)}
        aria-label={`Cidade de “${texto}”`}
      >
        <option value="">É a cidade...</option>
        {cidades.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-primary text-xs px-2 py-0.5"
        disabled={pending || !cidadeId}
        onClick={() =>
          start(async () => {
            const r = await associarApelidoCidade(texto, Number(cidadeId));
            setErro("error" in r ? r.error : null);
          })
        }
      >
        {pending ? "..." : "Associar"}
      </button>
      <button
        type="button"
        className="btn-link text-xs"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Criar a cidade nova “${texto}”? Use só se ela não estiver na lista.`)) return;
          start(async () => {
            const r = await criarCidadeDeGrafia(texto);
            setErro("error" in r ? r.error : null);
          });
        }}
      >
        Criar cidade nova
      </button>
      {erro && <span className="text-xs text-[var(--signal)]">{erro}</span>}
    </span>
  );
}

export function ApelidosDaCidade({ apelidos }: { apelidos: { id: number; apelido: string }[] }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-[var(--ink-soft)]/70 mb-1">Grafias reconhecidas como esta cidade</p>
      <div className="flex flex-wrap gap-2">
        {apelidos.map((a) => (
          <span key={a.id} className="text-xs rounded-full px-2 py-1 border border-[var(--line)] bg-[var(--card)]">
            {a.apelido}
            <button
              type="button"
              className="ml-1 text-[var(--signal)]"
              disabled={pending}
              aria-label={`Remover a grafia ${a.apelido}`}
              onClick={() => {
                if (!window.confirm(`Remover a grafia “${a.apelido}”? Ela volta a ficar não reconhecida.`)) return;
                start(async () => {
                  const r = await removerApelidoCidade(a.id);
                  setErro("error" in r ? r.error : null);
                });
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {erro && <span className="text-xs text-[var(--signal)]">{erro}</span>}
    </div>
  );
}

export function EditorVizinhanca({
  cidade,
  cidades,
  vizinhasIds,
}: {
  cidade: Cidade;
  cidades: Cidade[];
  vizinhasIds: number[];
}) {
  const [pending, start] = useTransition();
  const [marcadas, setMarcadas] = useState<number[]>(vizinhasIds);
  const [msg, setMsg] = useState<string | null>(null);
  const alternar = (id: number) =>
    setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  return (
    <div className="card p-3">
      <p className="font-medium text-sm mb-2 text-[var(--ink)]">{cidade.nome}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        {cidades
          .filter((c) => c.id !== cidade.id)
          .map((c) => (
            <label key={c.id} className="inline-flex items-center gap-1 text-xs">
              <input type="checkbox" checked={marcadas.includes(c.id)} onChange={() => alternar(c.id)} />
              {c.nome}
            </label>
          ))}
      </div>
      <button
        type="button"
        className="btn-primary text-xs px-3 py-1"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await salvarVizinhanca(cidade.id, marcadas);
            setMsg("error" in r ? r.error : "Salvo.");
          })
        }
      >
        {pending ? "Salvando..." : "Salvar vizinhas"}
      </button>
      {msg && <span className="ml-2 text-xs text-[var(--ink-soft)]/70">{msg}</span>}
    </div>
  );
}
