export default function MissaoCheckboxes({
  missoes,
  selecionadas,
}: {
  missoes: { id: number; nome: string }[];
  selecionadas: number[];
}) {
  return (
    <fieldset className="col-span-2 border border-[var(--line)] rounded p-3">
      <legend className="text-sm font-medium px-1">Missões que este usuário pode ver e editar</legend>
      <div className="grid grid-cols-2 gap-1 mt-1 max-h-48 overflow-y-auto">
        {missoes.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm py-0.5">
            <input
              type="checkbox"
              name="missaoIds"
              value={m.id}
              defaultChecked={selecionadas.includes(m.id)}
            />
            {m.nome}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
