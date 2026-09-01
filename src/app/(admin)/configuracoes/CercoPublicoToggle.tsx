"use client";

import { useState, useTransition } from "react";
import { alternarCercoPublicado } from "@/lib/actions";

export default function CercoPublicoToggle({
  missaoId,
  cercoPublicado,
}: {
  missaoId: number;
  cercoPublicado: boolean;
}) {
  const [publicado, setPublicado] = useState(cercoPublicado);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const novo = !publicado;
        setPublicado(novo);
        startTransition(() => {
          alternarCercoPublicado(missaoId, novo);
        });
      }}
      className={`inline-block rounded px-4 py-2 font-medium ${
        publicado
          ? "bg-[var(--signal)]/10 border border-[var(--signal)]/30 text-[var(--signal)]"
          : "bg-[var(--brass)] text-[var(--ink)]"
      }`}
    >
      {publicado ? "Tirar do ar" : "Publicar"}
    </button>
  );
}
