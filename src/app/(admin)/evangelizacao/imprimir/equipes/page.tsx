import Link from "next/link";
import { requireEvangelizacao } from "@/lib/auth";
import { carregarPainel } from "@/lib/evangelizacaoDados";
import { telefone } from "@/lib/format";
import { qtd } from "@/lib/exportarEquipes";
import BotaoImprimir from "../BotaoImprimir";

// Lista das equipes com os integrantes, para imprimir (funciona antes e depois de fechar a distribuição).
export default async function ImprimirListaEquipesPage() {
  const { missao } = await requireEvangelizacao();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const p = await carregarPainel(missao.id);
  const integrantes = p.equipes.reduce((n, e) => n + e.membros.length, 0);

  return (
    <div>
      <style>{`@media print { aside, header, nav { display: none !important; } main { padding: 0 !important; overflow: visible !important; } body { background: #fff !important; } }`}</style>
      <div className="mb-4 flex items-center gap-4 print:hidden">
        <BotaoImprimir />
        <a href="/evangelizacao/exportar" className="qd-btn qd-btn-ghost text-sm">
          Exportar (.xlsx)
        </a>
        <Link href="/evangelizacao" className="underline text-sm">
          Voltar
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Equipes de Evangelização</h1>
      <p className="text-sm mb-6">
        {missao.nome} · {qtd(p.equipes.length, "equipe", "equipes")} · {qtd(integrantes, "integrante", "integrantes")}
      </p>

      {p.equipes.length === 0 && <p className="text-sm">Nenhuma equipe ainda.</p>}

      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        {p.equipes.map((e) => (
          <section key={e.id} className="border border-[var(--line)] rounded-lg p-3" style={{ breakInside: "avoid" }}>
            <h2 className="font-semibold">
              {e.nome}
              <span className="ml-2 text-xs font-normal text-[var(--ink-soft)]">
                {qtd(e.membros.length, "integrante", "integrantes")} · {qtd(e.carros, "carro", "carros")} · {qtd(e.casas.length, "casa", "casas")}
              </span>
            </h2>
            <ul className="mt-2 text-sm space-y-0.5">
              {e.membros.map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span>
                    {m.nome}
                    {m.temCarro && <span className="ml-1 text-xs">(carro)</span>}
                  </span>
                  <span className="text-xs text-[var(--ink-soft)] whitespace-nowrap">
                    {[m.cidade ?? m.cidadeTexto, m.celular ? telefone(m.celular) : null].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
              {e.membros.length === 0 && <li className="text-xs text-[var(--ink-soft)]">Sem integrantes</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
