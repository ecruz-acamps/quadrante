"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SETORES_SEM_ALERTA_CONSECUTIVO } from "@/lib/constants";
import { Icon } from "./icons";
import { buscarPessoasGlobal, adicionarServoRapido, solicitarLiberacaoConflito } from "@/lib/actions";

type Sugestao = Awaited<ReturnType<typeof buscarPessoasGlobal>>[number];

const ALERTA_ESPIRITUAL =
  "Não é saudável espiritualmente um servo servir por mais que 2 vezes no mesmo setor. Utilize seus dons em outro local, seja obediente. Obediência gera graça.";

export default function AdicionarServoModal({
  missaoId,
  setor,
  variante = "cabecalho",
}: {
  missaoId: number;
  setor: string;
  variante?: "cabecalho" | "vazio"; // só muda o visual do botão que abre o modal
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [selecionada, setSelecionada] = useState<Sugestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [conflito, setConflito] = useState<{
    pessoaId: number;
    missaoId: number;
    missaoConflitoNome: string;
    distancia: number;
  } | null>(null);
  const [codigoLiberacao, setCodigoLiberacao] = useState("");
  const [liberacaoSolicitada, setLiberacaoSolicitada] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 0);
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setTermo("");
    setSugestoes([]);
    setMostrarSugestoes(false);
    setSelecionada(null);
    setErro(null);
    setConflito(null);
    setCodigoLiberacao("");
    setLiberacaoSolicitada(false);
  }

  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aberto]);

  function handleChange(valor: string) {
    setTermo(valor);
    setSelecionada(null);
    setErro(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const resultado = await buscarPessoasGlobal(missaoId, valor);
      setSugestoes(resultado);
      setMostrarSugestoes(resultado.length > 0);
    }, 300);
  }

  function selecionar(p: Sugestao) {
    if (p.jaEhServoNaMissao) return;
    setSelecionada(p);
    setMostrarSugestoes(false);
    setSugestoes([]);
  }

  function desfazerSelecao() {
    setSelecionada(null);
  }

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    const formData = new FormData();
    formData.set("missaoId", String(missaoId));
    formData.set("setor", setor);
    if (selecionada) {
      if (selecionada.origem === "pessoa") {
        formData.set("pessoaId", String(selecionada.id));
      } else {
        formData.set("neocampistaId", String(selecionada.id));
      }
    } else if (termo.trim()) {
      formData.set("nomeNovo", termo.trim());
    } else {
      setErro("Selecione uma pessoa ou digite um nome.");
      setEnviando(false);
      return;
    }
    if (codigoLiberacao) formData.set("codigoLiberacao", codigoLiberacao);

    const resultado = await adicionarServoRapido(formData);
    setEnviando(false);
    if (resultado && "conflito" in resultado && resultado.conflito) {
      setConflito(resultado.conflito);
      return;
    }
    if (resultado && "error" in resultado && resultado.error) {
      setErro(resultado.error);
      return;
    }
    fechar();
    router.refresh();
  }

  async function solicitarLiberacao() {
    if (!conflito) return;
    await solicitarLiberacaoConflito(conflito.pessoaId, conflito.missaoId);
    setLiberacaoSolicitada(true);
  }

  return (
    <>
      {variante === "vazio" ? (
        <button type="button" onClick={() => setAberto(true)} className="qd-btn qd-btn-cta">
          <Icon name="plus" className="h-4 w-4" />
          Adicionar primeiro servo
        </button>
      ) : (
        <button type="button" onClick={() => setAberto(true)} className="qd-btn qd-btn-soft px-3 py-2 text-xs">
          <Icon name="plus" className="h-3.5 w-3.5 text-[var(--brass)]" />
          <span>
            Adicionar<span className="hidden sm:inline"> servo</span>
          </span>
        </button>
      )}

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fechar();
          }}
        >
          <div className="card w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-spectral)] text-lg text-[var(--ink)]">
                Adicionar servo — {setor}
              </h2>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="text-[var(--ink-soft)] hover:text-[var(--ink)] text-lg leading-none"
              >
                ×
              </button>
            </div>

            {selecionada ? (
              <div className="flex items-center justify-between rounded border border-[var(--brass)]/40 bg-[var(--paper)] px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-[var(--ink)]">{selecionada.nome}</div>
                  <div className="text-xs text-[var(--ink-soft)]">
                    {[selecionada.cidade, `${selecionada.missoes} missões`].filter(Boolean).join(" · ")}
                    {selecionada.origem === "campista" && (
                      <span className="ml-2 text-[0.65rem] border border-[var(--brass)]/40 rounded px-1 py-px text-[var(--brass)]">
                        ex-campista
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={desfazerSelecao}
                  aria-label="Desfazer seleção"
                  className="text-[var(--ink-soft)] hover:text-[var(--signal)] text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>
            ) : null}

            {selecionada && selecionada.setorConsecutivo && selecionada.setorConsecutivo.vezes >= 2 && selecionada.setorConsecutivo.setor === setor && !SETORES_SEM_ALERTA_CONSECUTIVO.includes(setor) && (
              <div className="rounded border border-[var(--signal)]/50 bg-[var(--signal)]/10 px-3 py-2 text-sm text-[var(--signal)]">
                {ALERTA_ESPIRITUAL}
              </div>
            )}

            {!selecionada && (
              <div className="relative">
                <input
                  ref={inputRef}
                  value={termo}
                  onChange={(e) => handleChange(e.target.value)}
                  onFocus={() => setMostrarSugestoes(sugestoes.length > 0)}
                  onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
                  placeholder="Nome da pessoa"
                  autoComplete="off"
                  className="input w-full"
                />
                {mostrarSugestoes && (
                  <ul className="card absolute z-10 mt-1 w-full max-h-64 overflow-auto p-1">
                    {sugestoes.map((p) => (
                      <li key={`${p.origem}-${p.id}`}>
                        <button
                          type="button"
                          disabled={p.jaEhServoNaMissao}
                          onMouseDown={() => selecionar(p)}
                          className={`w-full text-left px-3 py-2 rounded ${
                            p.jaEhServoNaMissao
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-[var(--paper)]"
                          }`}
                        >
                          <div className="text-sm font-medium text-[var(--ink)] flex items-center gap-2">
                            {p.nome}
                            {p.origem === "campista" && (
                              <span className="text-[0.65rem] border border-[var(--brass)]/40 rounded px-1 py-px text-[var(--brass)]">
                                ex-campista
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--ink-soft)]">
                            {[p.cidade, `${p.missoes} missões`].filter(Boolean).join(" · ")}
                          </div>
                          {p.jaEhServoNaMissao && (
                            <div className="text-xs text-[var(--signal)] mt-0.5">já está no quadrante</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {conflito && (
              <div className="border border-[var(--signal)] rounded p-3 text-sm space-y-2">
                <p>
                  Já é servo ativo em <strong>{conflito.missaoConflitoNome}</strong>, a {conflito.distancia}{" "}
                  mês(es) de distância.
                </p>
                {!liberacaoSolicitada ? (
                  <button type="button" onClick={solicitarLiberacao} className="btn-primary px-3 py-1 text-sm">
                    Solicitar liberação da coordenação
                  </button>
                ) : (
                  <input
                    value={codigoLiberacao}
                    onChange={(e) => setCodigoLiberacao(e.target.value)}
                    placeholder="Código de 6 dígitos"
                    className="input"
                  />
                )}
              </div>
            )}

            {erro && <p className="text-[var(--signal)] text-sm">{erro}</p>}

            <div className="flex items-center justify-between gap-3 pt-2">
              {!selecionada && termo.trim().length >= 2 && sugestoes.length === 0 && (
                <button type="button" onClick={confirmar} disabled={enviando} className="btn-link text-sm">
                  Cadastrar novo: {termo.trim()}
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={fechar} className="btn-link text-sm">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={enviando || (!selecionada && !termo.trim())}
                  className="btn-primary px-4 py-1.5 text-sm"
                >
                  {enviando ? "Adicionando..." : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
