import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { criarFicha } from "@/lib/actions";
import FichaForm from "../FichaForm";

export default async function NovaFichaPage() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-6">Nova ficha</h1>
      <form action={criarFicha} className="card p-6 space-y-4">
        <input type="hidden" name="missaoId" value={missao.id} />
        <FichaForm />
        <button className="btn-primary px-6 py-2">Salvar</button>
      </form>
    </div>
  );
}
