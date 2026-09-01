"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { excluirServo, marcarDesistiu, marcarRecusou } from "@/lib/actions";

function ModalMotivo({
  titulo,
  motivo,
  setMotivo,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  titulo: string;
  motivo: string;
  setMotivo: (v: string) => void;
  enviando: boolean;
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

  async function excluir() {
    setEnviando(true);
    const formData = new FormData();
    formData.set("id", String(servoId));
    await excluirServo(formData);
    setEnviando(false);
    setAbertoExcluir(false);
    router.refresh();
  }

  async function confirmarDesistiu() {
    setEnviando(true);
    const formData = new FormData();
    formData.set("id", String(servoId));
    formData.set("motivo", motivo.trim());
    await marcarDesistiu(formData);
    setEnviando(false);
    setAbertoDesistiu(false);
    setAbertoExcluir(false);
    setMotivo("");
    router.refresh();
  }

  async function confirmarRecusou() {
    setEnviando(true);
    const formData = new FormData();
    formData.set("id", String(servoId));
    formData.set("motivo", motivo.trim());
    await marcarRecusou(formData);
    setEnviando(false);
    setAbertoRecusou(false);
    setMotivo("");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbertoRecusou(true)}
        disabled={enviando}
        className="text-[var(--signal)] hover:underline text-sm font-medium"
      >
        Dizer não
      </button>
      <button
        type="button"
        onClick={() => setAbertoDesistiu(true)}
        disabled={enviando}
        className="text-[var(--brass)] hover:underline text-sm font-medium"
      >
        Desistiu
      </button>
      <button type="button" onClick={() => setAbertoExcluir(true)} className="btn-danger-link">
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
              <strong>Desistiu</strong> / <strong>Dizer não</strong> para manter o histórico.
            </p>
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
          onCancelar={() => {
            setAbertoDesistiu(false);
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
          onCancelar={() => {
            setAbertoRecusou(false);
            setMotivo("");
          }}
          onConfirmar={confirmarRecusou}
        />
      )}
    </>
  );
}
