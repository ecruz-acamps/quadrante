"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarAceitou } from "@/lib/actions";

// "Disse sim": confirma que a pessoa aceitou servir e avisa pelo Pushbird.
export default function AceitouButton({ servoId, confirmado }: { servoId: number; confirmado: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function aceitar() {
    setEnviando(true);
    setErro("");
    try {
      const formData = new FormData();
      formData.set("id", String(servoId));
      await marcarAceitou(formData);
      router.refresh();
    } catch {
      setErro("Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  }

  if (confirmado) {
    return (
      <span className="rounded-md bg-green-600/10 px-2 py-1 text-xs font-medium text-green-700" title="Já confirmou que vai servir">
        ✓ Disse sim
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={aceitar}
        disabled={enviando}
        title={erro || undefined}
        className="rounded-md border border-green-600/40 px-2 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-600/10 disabled:opacity-50"
      >
        {enviando ? "Salvando..." : erro ? "Tentar de novo" : "Disse sim"}
      </button>
    </>
  );
}
