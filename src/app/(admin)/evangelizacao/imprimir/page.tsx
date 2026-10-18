import Link from "next/link";
import { requireEvangelizacao } from "@/lib/auth";
import { carregarPainel } from "@/lib/evangelizacaoDados";
import BotaoImprimir from "./BotaoImprimir";

export default async function ImprimirEvangelizacaoPage() {
  const { missao } = await requireEvangelizacao();
  if (!missao) return <p>Nenhuma missão ativa.</p>;

  const p = await carregarPainel(missao.id);
  if (!p.fechada) {
    return (
      <div>
        <h1 className="page-title mb-4">Imprimir equipes</h1>
        <p className="text-sm mb-2">Feche a distribuição para imprimir.</p>
        <Link href="/evangelizacao" className="underline text-sm">
          Voltar para Evangelização
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* esconde o menu lateral e o cabeçalho do painel na impressão */}
      <style>{`@media print { aside, header, nav { display: none !important; } main { padding: 0 !important; overflow: visible !important; } }`}</style>
      <div className="mb-4 flex items-center gap-4 print:hidden">
        <BotaoImprimir />
        <Link href="/evangelizacao" className="underline text-sm">
          Voltar
        </Link>
      </div>

      {p.equipes.map((e) => (
        <section key={e.id} style={{ breakAfter: "page", pageBreakAfter: "always" }} className="mb-10">
          <h1 className="text-2xl font-semibold mb-1">{e.nome}</h1>
          <p className="text-sm mb-4">{missao.nome}: Evangelização</p>
          <h2 className="font-medium mb-1">Equipe</h2>
          <ul className="mb-4 text-sm">
            {e.membros.map((m) => (
              <li key={m.id}>
                {m.nome} {m.celular ? `· ${m.celular}` : ""} {m.temCarro ? "· 🚗 carro" : ""}
              </li>
            ))}
          </ul>
          <h2 className="font-medium mb-1">Casas ({e.casas.length})</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {e.casas.map((c) => (
              <li key={c.id}>
                <strong>{c.nome}</strong>
                <br />
                {[c.endereco, c.bairro, c.cidade ?? c.cidadeTexto].filter(Boolean).join(" · ")}
                {c.celular ? ` · ${c.celular}` : ""}
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section>
        <h1 className="text-2xl font-semibold mb-4">Resumo: casas por cidade</h1>
        <ul className="text-sm">
          {p.casasPorCidade.map(([cidade, n]) => (
            <li key={cidade}>
              {cidade}: {n}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
