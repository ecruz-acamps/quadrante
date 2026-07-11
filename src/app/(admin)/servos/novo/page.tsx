import { getMissaoAtiva } from "@/lib/auth";
import { criarServo } from "@/lib/actions";
import ServoForm from "../ServoForm";

export default async function NovoServoPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Novo servo</h1>
      <form action={criarServo} className="card p-6 space-y-4">
        <input type="hidden" name="missaoId" value={missao.id} />
        <ServoForm missaoId={missao.id} />
        <button className="btn-primary px-6 py-2">Salvar</button>
      </form>
    </div>
  );
}
