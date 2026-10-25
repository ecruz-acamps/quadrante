"use client";

import { useState, useTransition } from "react";
import {
  aprovarCandidatoServir, parecidasDoCandidatoServir, reabrirCandidatoServir, recusarCandidatoServir,
} from "@/lib/actionsServir";
import { solicitarLiberacaoConflito } from "@/lib/actions";
import type { RespostaSalva } from "@/lib/servirRespostas";

type Parecida = Awaited<ReturnType<typeof parecidasDoCandidatoServir>>[number];

export type CandidatoView = {
  id: number;
  nome: string;
  celular: string;
  cpf: string;
  casado: boolean;
  conjugeNome: string | null;
  conjugeCelular: string | null;
  disponivel: boolean;
  status: string;
  criadoEm: string;
  respostas: RespostaSalva[];
  conjuge: { id: number; nome: string } | null;
};

const MOTIVO = { cpf: "mesmo CPF", nome: "mesmo nome", celular: "mesmo celular" } as const;

export default function LinhaCandidato({
  candidato: c,
  setores,
  missaoId,
}: {
  candidato: CandidatoView;
  setores: string[];
  missaoId: number;
}) {
  const [respostasAbertas, setRespostasAbertas] = useState(false);
  const [painel, setPainel] = useState(false);
  const [parecidas, setParecidas] = useState<Parecida[] | null>(null);
  const [setor, setSetor] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [conflito, setConflito] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrirPainel() {
    setPainel(true);
    startTransition(async () => setParecidas(await parecidasDoCandidatoServir(c.id)));
  }

  function aprovar() {
    const dados = new FormData();
    dados.set("candidatoId", String(c.id));
    dados.set("setor", setor);
    dados.set("pessoaId", pessoaId);
    dados.set("codigoLiberacao", codigo);
    startTransition(async () => {
      const r = await aprovarCandidatoServir(null, dados);
      if ("ok" in r && r.ok) return;
      if ("conflito" in r) {
        setConflito(`Já é servo em “${r.conflito.missaoConflitoNome}” (${r.conflito.distancia} mês(es) de distância).`);
        setMensagem(null);
      } else {
        setMensagem("erro" in r ? r.erro : "Não foi possível aprovar.");
      }
    });
  }

  const outras = c.respostas.length;
  return (
    <div className="card p-4 space-y-2" id={`candidato-${c.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--ink)]">
            {c.nome}{" "}
            <span className="text-xs font-normal text-[var(--ink-soft)]/70">
              {c.status === "APROVADO" ? "· aprovado" : c.status === "RECUSADO" ? "· recusado" : ""}
            </span>
          </p>
          <p className="text-xs text-[var(--ink-soft)]/80">
            {c.celular} · CPF {c.cpf} · {c.disponivel ? "disponível" : "indisponível"} ·{" "}
            {new Date(c.criadoEm).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {c.status === "PENDENTE" && (
            <>
              <button type="button" disabled={!c.disponivel || pending} onClick={abrirPainel} className="btn-primary px-3 py-1.5">
                Aprovar
              </button>
              <button type="button" disabled={pending} onClick={() => startTransition(async () => void (await recusarCandidatoServir(c.id)))} className="btn-link">
                Recusar
              </button>
            </>
          )}
          {c.status === "RECUSADO" && (
            <button type="button" disabled={pending} onClick={() => startTransition(async () => void (await reabrirCandidatoServir(c.id)))} className="btn-link">
              Reabrir
            </button>
          )}
        </div>
      </div>

      {c.casado && (
        <p className="text-sm">
          {c.conjuge ? (
            <>
              Cônjuge: <strong>{c.conjuge.nome}</strong> (também é candidato nesta missão){" "}
              <a href={`#candidato-${c.conjuge.id}`} className="underline">
                ver
              </a>
            </>
          ) : (
            <>
              Cônjuge informado: {c.conjugeNome}, {c.conjugeCelular}
            </>
          )}
        </p>
      )}

      {outras > 0 && (
        <button type="button" onClick={() => setRespostasAbertas(!respostasAbertas)} className="btn-link text-sm">
          {respostasAbertas ? "Ocultar respostas" : `Ver respostas (${outras})`}
        </button>
      )}
      {respostasAbertas && (
        <dl className="text-sm divide-y divide-[var(--line)] rounded border border-[var(--line)]">
          {c.respostas.map((r) => (
            <div key={r.perguntaId} className="px-3 py-1.5">
              <dt className="text-[var(--ink-soft)]/70 text-xs">{r.titulo}</dt>
              <dd>{Array.isArray(r.valor) ? r.valor.join(", ") : r.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {painel && c.status === "PENDENTE" && (
        <div className="rounded border border-[var(--line)] p-3 space-y-3 text-sm">
          <label className="block">
            <span className="font-medium">Setor</span>
            <select value={setor} onChange={(e) => setSetor(e.target.value)} className="input mt-1">
              <option value="">Escolha o setor…</option>
              {setores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-1">
            <legend className="font-medium">Quem é essa pessoa no cadastro?</legend>
            {parecidas === null && <p className="text-xs">Procurando…</p>}
            {parecidas?.map((p) => (
              <label key={p.id} className="flex items-start gap-2">
                <input
                  type="radio"
                  name={`pessoa-${c.id}`}
                  checked={pessoaId === String(p.id)}
                  disabled={p.setorNaMissao !== null}
                  onChange={() => setPessoaId(String(p.id))}
                  className="mt-1"
                />
                <span>
                  {p.nome} <span className="text-xs text-[var(--ink-soft)]/70">({MOTIVO[p.motivo]})</span>
                  {p.setorNaMissao !== null && (
                    <span className="block text-xs text-[var(--signal)]">Já está no quadrante desta missão (setor {p.setorNaMissao})</span>
                  )}
                  {p.historico.length > 0 && (
                    <span className="block text-xs text-[var(--ink-soft)]/70">
                      {p.historico.map((h) => `${h.missao}: ${h.setor}`).join(" · ")}
                    </span>
                  )}
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="radio" name={`pessoa-${c.id}`} checked={pessoaId === ""} onChange={() => setPessoaId("")} />
              Criar pessoa nova
            </label>
          </fieldset>
          {conflito && (
            <div className="rounded bg-[var(--signal)]/10 p-2 space-y-2">
              <p>{conflito} Precisa de um código de liberação.</p>
              <div className="flex gap-2">
                <button type="button" className="btn-link" onClick={() => pessoaId && startTransition(async () => void (await solicitarLiberacaoConflito(Number(pessoaId), missaoId)))}>
                  Pedir código
                </button>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" placeholder="Código" className="input w-32" />
              </div>
            </div>
          )}
          {mensagem && (
            <p role="alert" className="text-[var(--signal)]">
              {mensagem}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={!setor || pending} onClick={aprovar} className="btn-primary px-3 py-1.5">
              Confirmar
            </button>
            <button type="button" onClick={() => setPainel(false)} className="btn-link">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
