"use client";

import { Icon } from "./icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { listarMissoesComNeocampistas, chamarEvangelizacao } from "@/lib/actions";

type MissaoOpcao = Awaited<ReturnType<typeof listarMissoesComNeocampistas>>[number];

export default function ChamarEvangelizacaoModal({ missaoDestinoId }: { missaoDestinoId: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [missoes, setMissoes] = useState<MissaoOpcao[]>([]);
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof chamarEvangelizacao>> | null>(null);

  function abrir() {
    setAberto(true);
    setResultado(null);
    setCarregando(true);
    listarMissoesComNeocampistas().then((lista) => {
      setMissoes(lista);
      setSelecionadaId(lista[0]?.id ?? null);
      setCarregando(false);
    });
  }

  function fechar() {
    setAberto(false);
    setResultado(null);
  }

  async function confirmar() {
    if (!selecionadaId) return;
    setEnviando(true);
    const r = await chamarEvangelizacao(selecionadaId, missaoDestinoId);
    setEnviando(false);
    setResultado(r);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={abrir} className="qd-btn qd-btn-ghost">
        <Icon name="megaphone" className="h-4 w-4 text-[var(--brass)]" />
        Chamar Evangelização
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fechar();
          }}
        >
          <div className="card w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-spectral)] text-lg text-[var(--ink)]">Chamar Evangelização</h2>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="text-[var(--ink-soft)] hover:text-[var(--ink)] text-lg leading-none"
              >
                ×
              </button>
            </div>

            {!resultado ? (
              <>
                <p className="text-sm text-[var(--ink-soft)]">
                  Escolha de qual edição você quer puxar os neocampistas. Todos serão adicionados como servos no
                  setor Evangelização desta missão.
                </p>

                {carregando ? (
                  <p className="text-sm text-[var(--ink-soft)]/60">Carregando...</p>
                ) : missoes.length === 0 ? (
                  <p className="text-sm text-[var(--ink-soft)]/60">Nenhuma missão com neocampistas cadastrados.</p>
                ) : (
                  <select
                    value={selecionadaId ?? ""}
                    onChange={(e) => setSelecionadaId(Number(e.target.value))}
                    className="input w-full"
                  >
                    {missoes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} — {m.tipo} {m.ano} ({m.totalNeocampistas} neocampistas)
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={fechar} className="btn-link text-sm">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={enviando || !selecionadaId}
                    className="btn-primary px-4 py-1.5 text-sm"
                  >
                    {enviando ? "Chamando..." : "Chamar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-[var(--ink)] space-y-1">
                  <p>
                    <strong>{resultado.adicionados}</strong> adicionados à Evangelização.
                  </p>
                  {resultado.jaEstavam > 0 && (
                    <p className="text-[var(--ink-soft)]">{resultado.jaEstavam} já estavam nesta missão.</p>
                  )}
                  {resultado.comConflito > 0 && (
                    <p className="text-[var(--signal)]">
                      {resultado.comConflito} com conflito de proximidade com outra missão (não adicionados).
                    </p>
                  )}
                </div>
                <div className="flex justify-end pt-2">
                  <button type="button" onClick={fechar} className="btn-primary px-4 py-1.5 text-sm">
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
