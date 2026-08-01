"use client";

import { useState, useTransition } from "react";
import { atualizarServoInline } from "@/lib/actions";
import { CAMISETAS, FUNCOES, HORARIOS_CERCO } from "@/lib/constants";

export function CamisetaInlineSelect({ servoId, camiseta }: { servoId: number; camiseta: string | null }) {
  const [valor, setValor] = useState(camiseta ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={valor}
      disabled={pending}
      onChange={(e) => {
        const novo = e.target.value;
        setValor(novo);
        startTransition(() => {
          atualizarServoInline(servoId, { camiseta: novo || null });
        });
      }}
      className="input py-1 text-xs"
    >
      <option value="">—</option>
      {CAMISETAS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export function FuncaoInlineSelect({ servoId, funcao }: { servoId: number; funcao: string }) {
  const [valor, setValor] = useState(funcao);
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={valor}
      disabled={pending}
      onChange={(e) => {
        const novo = e.target.value;
        setValor(novo);
        startTransition(() => {
          atualizarServoInline(servoId, { funcao: novo });
        });
      }}
      className="input py-1 text-xs"
    >
      {FUNCOES.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
}

export function CercoInlineSelect({ servoId, cercoHorario }: { servoId: number; cercoHorario: string | null }) {
  const [valor, setValor] = useState(cercoHorario ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={valor}
      disabled={pending}
      onChange={(e) => {
        const novo = e.target.value;
        setValor(novo);
        startTransition(() => {
          atualizarServoInline(servoId, { cercoHorario: novo || null });
        });
      }}
      className="input py-1 text-xs"
    >
      <option value="">—</option>
      {HORARIOS_CERCO.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}

export function PagoInlineSelect({ servoId, pago }: { servoId: number; pago: boolean }) {
  const [valor, setValor] = useState(pago);
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={valor ? "sim" : "nao"}
      disabled={pending}
      onChange={(e) => {
        const novo = e.target.value === "sim";
        setValor(novo);
        startTransition(() => {
          atualizarServoInline(servoId, { pago: novo });
        });
      }}
      className="input py-1 text-xs"
    >
      <option value="sim">Sim</option>
      <option value="nao">Não</option>
    </select>
  );
}
