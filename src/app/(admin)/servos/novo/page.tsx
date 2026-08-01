import { getMissaoAtiva } from "@/lib/auth";
import { criarServo } from "@/lib/actions";
import { db } from "@/lib/db";
import ServoForm from "../ServoForm";
import ServoFormClient from "../ServoFormClient";

export default async function NovoServoPage() {
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;
  const setores = await db.setor.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="max-w-3xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Novo servo</h1>
      <ServoFormClient action={criarServo} pessoaNome="Este servo">
        <input type="hidden" name="missaoId" value={missao.id} />
        <ServoForm missaoId={missao.id} setores={setores} />
      </ServoFormClient>
    </div>
  );
}
