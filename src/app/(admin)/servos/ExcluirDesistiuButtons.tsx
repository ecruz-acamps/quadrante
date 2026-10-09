"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { excluirServo, marcarDesistiu, marcarRecusou } from "@/lib/actions";

function ModalMotivo({
  titulo,
  motivo,
  setMotivo,
  enviando,
  erro,
  onCancelar,
  onConfirmar,
}: {
  titulo: string;
  motivo: string;
  setMotivo: (v: string) => void;
  enviando: boolean;
  erro: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancelar();
      }}
    >
      <div className="card w-full max-w-sm p-5 space-y-4">
        <p className="text-sm text-[var(--ink)]">{titulo}</p>
        <textarea
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          rows={3}
          className="input w-full"
        />
        {erro && (
          <p role="alert" className="text-sm text-[var(--signal)]">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="btn-link text-sm">
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} disabled={enviando} className="btn-primary px-4 py-1.5 text-sm">
            {enviando ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExcluirDesistiuButtons({ servoId }: { servoId: number }) {
  const router = useRouter();
  const [abertoExcluir, setAbertoExcluir] = useState(false);
  const [abertoDesistiu, setAbertoDesistiu] = useState(false);
  const [abertoRecusou, setAbertoRecusou] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // roda a ação; se falhar (rede, sessão, permissão) mantém o modal aberto e mostra o motivo em vez de travar o botão
  async function executar(acao: () => Promise<unknown>, aoSucesso: () => void) {
    setEnviando(true);
    setErro("");
    try {
      await acao();
      aoSucesso();
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  function dados(comMotivo: boolean) {
    const formData = new FormData();
    formData.set("id", String(servoId));
    if (comMotivo) formData.set("motivo", motivo.trim());
    return formData;
  }

  const excluir = () =>
    executar(
      () => excluirServo(dados(false)),
      () => setAbertoExcluir(false),
    );

  const confirmarDesistiu = () =>
    executar(
      () => marcarDesistiu(dados(true)),
      () => {
        setAbertoDesistiu(false);
        setAbertoExcluir(false);
        setMotivo("");
      },
    );

  const confirmarRecusou = () =>
    executar(
      () => marcarRecusou(dados(true)),
      () => {
        setAbertoRecusou(false);
        setMotivo("");
      },
    );

  function fechar(setAberto: (v: boolean) => void) {
    setAberto(false);
    setErro("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setErro(""); setAbertoRecusou(true); }}
        disabled={enviando}
        className="rounded-md px-2 py-1 text-xs font-medium text-[#8a92a8] transition-colors hover:bg-[var(--signal-soft)] hover:text-[var(--signal)] disabled:opacity-50"
      >
        Disse não
      </button>
      <button
        type="button"
        onClick={() => { setErro(""); setAbertoDesistiu(true); }}
        disabled={enviando}
        className="rounded-md px-2 py-1 text-xs font-medium text-[#8a92a8] transition-colors hover:bg-[var(--amber-soft)] hover:text-[var(--amber)] disabled:opacity-50"
      >
        Desistiu
      </button>
      <button
        type="button"
        onClick={() => { setErro(""); setAbertoExcluir(true); }}
        className="rounded-md px-2 py-1 text-xs font-medium text-[#8a92a8] transition-colors hover:bg-[var(--signal-soft)] hover:text-[var(--signal)]"
      >
        Excluir
      </button>

      {abertoExcluir && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAbertoExcluir(false);
          }}
        >
          <div className="card w-full max-w-sm p-5 space-y-4">
            <p className="text-sm text-[var(--ink)]">
              Tem certeza que deseja excluir este servo? Se a pessoa apenas desistiu ou disse não, prefira os botões{" "}
              <strong>Desistiu</strong> / <strong>Disse não</strong> para manter o histórico.
            </p>
            {erro && (
              <p role="alert" className="text-sm text-[var(--signal)]">
                {erro}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAbertoExcluir(false)} className="btn-link text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAbertoExcluir(false);
                  setAbertoDesistiu(true);
                }}
                disabled={enviando}
                className="px-3 py-1.5 text-sm rounded border border-[var(--brass)] text-[var(--brass)] hover:bg-[var(--brass)]/10"
              >
                Desistiu
              </button>
              <button
                type="button"
                onClick={excluir}
                disabled={enviando}
                className="px-3 py-1.5 text-sm rounded bg-[var(--signal)] text-[var(--paper)] hover:opacity-90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {abertoDesistiu && (
        <ModalMotivo
          titulo="Por que a pessoa desistiu?"
          motivo={motivo}
          setMotivo={setMotivo}
          enviando={enviando}
          erro={erro}
          onCancelar={() => {
            fechar(setAbertoDesistiu);
            setMotivo("");
          }}
          onConfirmar={confirmarDesistiu}
        />
      )}

      {abertoRecusou && (
        <ModalMotivo
          titulo="Por que a pessoa disse não ao chamado?"
          motivo={motivo}
          setMotivo={setMotivo}
          enviando={enviando}
          erro={erro}
          onCancelar={() => {
            fechar(setAbertoRecusou);
            setMotivo("");
          }}
          onConfirmar={confirmarRecusou}
        />
      )}
    </>
  );
}
