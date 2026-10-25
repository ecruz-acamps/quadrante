import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { garantirPerguntasIniciais, listarPerguntasAdmin } from "@/lib/servirPerguntasDb";
import EditorPerguntas from "./EditorPerguntas";

export default async function PerguntasServirPage() {
  await requireRole("SUPER");
  await garantirPerguntasIniciais(db);
  const perguntas = await listarPerguntasAdmin(db);

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-2">Perguntas do formulário “Quero servir”</h1>
      <p className="text-sm text-[var(--ink-soft)]/80 mb-6">
        Valem para todas as missões. Nome, CPF, celular, estado civil (com os dados do cônjuge) e “Você pode servir
        nesta missão?” são fixos e sempre obrigatórios. Excluir uma pergunta só a desativa: as respostas antigas
        continuam visíveis na triagem.
      </p>
      <EditorPerguntas perguntas={perguntas} />
    </div>
  );
}
