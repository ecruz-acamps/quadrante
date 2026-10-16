import { ordenarSetores } from "@/lib/constants";
import { getMissaoAtiva, requireUser } from "@/lib/auth";
import { criarServo } from "@/lib/actions";
import { db } from "@/lib/db";
import ServoForm from "../ServoForm";
import ServoFormClient from "../ServoFormClient";

export default async function NovoServoPage() {
  await requireUser();
  const missao = await getMissaoAtiva();
  if (!missao) return <p>Nenhuma missão ativa.</p>;
  const setores = await ordenarSetores(await db.setor.findMany({ orderBy: { nome: "asc" } }));

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-6">Novo servo</h1>
      <ServoFormClient action={criarServo} pessoaNome="Este servo">
        <input type="hidden" name="missaoId" value={missao.id} />
        <ServoForm missaoId={missao.id} setores={setores} />
      </ServoFormClient>
    </div>
  );
}
