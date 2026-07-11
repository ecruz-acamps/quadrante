"use client";

import { excluirMissao } from "@/lib/actions";

export default function ExcluirMissaoButton({ id, nome }: { id: number; nome: string }) {
  return (
    <form
      action={excluirMissao}
      onSubmit={(e) => {
        if (!confirm(`Excluir a missão "${nome}"? Isso apaga todos os servos, neocampistas e tribos vinculados. Não pode ser desfeito.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger-link text-sm">Excluir</button>
    </form>
  );
}
