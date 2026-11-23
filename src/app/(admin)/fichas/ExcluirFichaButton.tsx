"use client";

import { excluirFicha } from "@/lib/actions";

// Excluir ficha só depois de confirmar (a ficha some do sistema; os arquivos vão para a lixeira do OneDrive).
export default function ExcluirFichaButton({ id, numero, nome, arquivos }: { id: number; numero: number; nome: string; arquivos: number }) {
  return (
    <form
      action={excluirFicha}
      className="inline"
      onSubmit={(e) => {
        const extra = arquivos > 0 ? `\n\n${arquivos === 1 ? "O arquivo da ficha preenchida vai" : `Os ${arquivos} arquivos da ficha preenchida vão`} para a lixeira do OneDrive.` : "";
        if (!window.confirm(`Você realmente quer excluir esta ficha?\n\nFicha ${numero} — ${nome}${extra}`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger-link">Excluir</button>
    </form>
  );
}
