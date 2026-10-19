"use client";

import { MIME_SERVO, useQuadranteDnd } from "./QuadranteDnd";

// Alça para arrastar o servo até outro card de setor; o select faz o mesmo onde arrastar não funciona (celular).
export default function MoverServo({
  servoId,
  nome,
  setorAtual,
  setores,
}: {
  servoId: number;
  nome: string;
  setorAtual: string;
  setores: string[];
}) {
  const { mover } = useQuadranteDnd();
  return (
    <>
      <span
        draggable
        title="Arraste para outro setor"
        aria-label={`Arrastar ${nome} para outro setor`}
        onDragStart={(e) => {
          e.dataTransfer.setData(MIME_SERVO, JSON.stringify({ servoId, nome, setorAtual }));
          e.dataTransfer.effectAllowed = "move";
        }}
        className="hidden shrink-0 cursor-grab select-none px-0.5 text-lg leading-none text-[#b3b9c9] hover:text-[var(--ink)] active:cursor-grabbing sm:block"
      >
        ⠿
      </span>
      <select
        aria-label={`Mover ${nome} para outro setor`}
        value=""
        onChange={(e) => e.target.value && mover(servoId, nome, e.target.value)}
        className="qd-select !w-auto shrink-0 !py-1 text-xs sm:hidden"
      >
        <option value="">Mover…</option>
        {setores
          .filter((x) => x !== setorAtual)
          .map((x) => (
            <option key={x}>{x}</option>
          ))}
      </select>
    </>
  );
}
