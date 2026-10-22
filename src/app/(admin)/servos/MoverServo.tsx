"use client";

import { MIME_SERVO } from "./QuadranteDnd";

// Alça para arrastar o servo até outro card de setor; só no computador (no celular o nome do servo fica em destaque).
export default function MoverServo({
  servoId,
  nome,
  setorAtual,
}: {
  servoId: number;
  nome: string;
  setorAtual: string;
}) {
  return (
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
  );
}
