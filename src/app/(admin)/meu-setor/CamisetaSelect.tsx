"use client";

import { useState, useTransition } from "react";
import { atualizarCamisetaServo } from "@/lib/actions";
import { CAMISETAS } from "@/lib/constants";

// Salva ao mudar; se o servidor recusar ou a rede falhar, volta ao valor anterior e avisa.
export default function CamisetaSelect({ servoId, camiseta }: { servoId: number; camiseta: string | null }) {
  const [valor, setValor] = useState(camiseta ?? "");
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();
  const fora = valor !== "" && !CAMISETAS.includes(valor);

  function alterar(novo: string) {
    const anterior = valor;
    setValor(novo);
    setErro("");
    startTransition(async () => {
      try {
        const r = await atualizarCamisetaServo(servoId, novo || null);
        if (r.error) {
          setValor(anterior);
          setErro(r.error);
        }
      } catch {
        setValor(anterior);
        setErro("Não salvou. Verifique a conexão e tente de novo.");
      }
    });
  }

  return (
    <div>
      <select
        value={valor}
        disabled={pending}
        aria-invalid={Boolean(erro)}
        onChange={(e) => alterar(e.target.value)}
        className="qd-select qd-tone-neutro"
      >
        <option value="">—</option>
        {fora && <option value={valor}>{valor}</option>}
        {CAMISETAS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {erro && (
        <p role="alert" className="mt-1 text-[0.7rem] leading-tight text-[var(--signal)]">
          {erro}
        </p>
      )}
    </div>
  );
}
