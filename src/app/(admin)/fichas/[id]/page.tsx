import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { acessoRegistros } from "@/lib/autorizacao";
import { atualizarFicha } from "@/lib/actions";
import FichaForm from "../FichaForm";
import ArquivoFicha from "../ArquivoFicha";
import ComprovantePix from "../ComprovantePix";
import { lerPartes } from "@/lib/fichaArquivos";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditarFichaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nova?: string }>;
}) {
  const usuario = await requireUser();
  const { id } = await params;
  const { nova } = await searchParams;
  if (!(await acessoRegistros(usuario, ["ficha", Number(id)]))) notFound();
  const ficha = await db.neocampista.findUnique({
    where: { id: Number(id) },
    include: { arquivos: { orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true, nome: true, url: true, partes: true } } },
  });
  if (!ficha) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-6">{nova ? "Ficha cadastrada" : "Editar ficha"} #{ficha.numero}</h1>

      <div className="card p-4 mb-6 space-y-2">
        {nova && (
          <p className="text-sm text-green-700">
            Ficha de {ficha.nome} salva. Agora envie a ficha preenchida (foto ou PDF).{" "}
            <Link href="/fichas/novo" className="underline text-[var(--ink)]">Cadastrar outra ficha</Link>
          </p>
        )}
        <h2 className="font-medium text-[var(--ink)]">Ficha preenchida</h2>
        <p className="text-xs text-[var(--ink-soft)]/70">
          Vai para o OneDrive (pasta da missão › Fichas) com o nome &quot;{String(ficha.numero).padStart(3, "0")} - {ficha.nome}&quot;; com mais de
          uma foto, todas entram no mesmo PDF (uma por página). Depois do sorteio, uma cópia vai para a pasta da cor da tribo.
        </p>
        <ArquivoFicha
          fichaId={ficha.id}
          arquivos={ficha.arquivos.map((a) => ({ ...a, partes: a.partes == null ? null : lerPartes(a.partes) }))}
          erro={ficha.arquivoErro}
        />
      </div>
      {(ficha.pagamento === "PIX" || ficha.comprovanteItemId) && (
        <ComprovantePix fichaId={ficha.id} nome={ficha.comprovanteNome} url={ficha.comprovanteUrl} situacao={ficha.situacao} />
      )}

      <form action={atualizarFicha} className="card p-6 space-y-4">
        <input type="hidden" name="id" value={ficha.id} />
        {/* remonta quando o comprovante chega ou sai, para liberar/bloquear o "OK - PAGO" */}
        <FichaForm key={ficha.comprovanteItemId ?? "sem-comprovante"} ficha={ficha} />
        <button className="btn-primary px-6 py-2">Salvar</button>
      </form>
    </div>
  );
}
