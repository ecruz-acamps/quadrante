"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { excluirServo, marcarDesistiu } from "@/lib/actions";

export default function ExcluirDesistiuButtons({ servoId }: { servoId: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function excluir() {
    setEnviando(true);
    const formData = new FormData();
    formData.set("id", String(servoId));
    await excluirServo(formData);
    setEnviando(false);
    setAberto(false);
    router.refresh();
  }

  async function desistiu() {
    setEnviando(true);
    const formData = new FormData();
    formData.set("id", String(servoId));
    await marcarDesistiu(formData);
    setEnviando(false);
    setAberto(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={desistiu}
        disabled={enviando}
        className="text-[var(--brass)] hover:underline text-sm font-medium"
      >
        Desistiu
      </button>
      <button type="button" onClick={() => setAberto(true)} className="btn-danger-link">
        Excluir
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAberto(false);
          }}
        >
          <div className="card w-full max-w-sm p-5 space-y-4">
            <p className="text-sm text-[var(--ink)]">
              Tem certeza que deseja excluir este servo? Se a pessoa apenas desistiu, prefira o botão{" "}
              <strong>Desistiu</strong> para manter o histórico.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAberto(false)} className="btn-link text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={desistiu}
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
    </>
  );
}
