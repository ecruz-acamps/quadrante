import { requireRole } from "@/lib/auth";

export default async function GeradorFichasPage() {
  await requireRole("SUPER");
  return (
    <div className="max-w-xl">
      <h1 className="page-title mb-2">Gerador de Fichas</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-6">
        Gera as fichas de inscrição em PDF, idênticas ao modelo. Só o número da missão, a data e o número da ficha mudam.
        Todas as fichas saem em um único arquivo ZIP.
      </p>
      <form action="/gerador-fichas/gerar" method="get" className="card p-5 grid grid-cols-2 gap-4">
        <label className="text-sm">
          Número da missão
          <input name="missao" type="number" min={1} required placeholder="23" className="input" />
        </label>
        <label className="text-sm">
          Quantidade de fichas
          <input name="quantidade" type="number" min={1} max={300} required placeholder="100" className="input" />
        </label>
        <label className="text-sm col-span-2">
          Data (abaixo do número da missão)
          <input name="data" required placeholder="29 de abril a 03 de maio de 2026" className="input" />
        </label>
        <label className="text-sm">
          Primeira ficha nº
          <input name="inicio" type="number" min={1} defaultValue={1} required className="input" />
        </label>
        <div className="col-span-2">
          <button className="btn-primary">Gerar e baixar ZIP</button>
        </div>
      </form>
    </div>
  );
}
