import { requireEvangelizacao } from "@/lib/auth";
import { carregarPainel } from "@/lib/evangelizacaoDados";
import { nomeArquivoEquipes, planilhaEquipes } from "@/lib/exportarEquipes";

// Botão "Exportar equipes": Excel com os integrantes de cada equipe e as casas de cada uma.
export async function GET() {
  const { missao } = await requireEvangelizacao();
  if (!missao) return new Response("Nenhuma missão ativa.", { status: 400 });

  const p = await carregarPainel(missao.id);
  const wb = planilhaEquipes(
    missao.nome,
    p.equipes.map((e) => ({
      nome: e.nome,
      membros: e.membros.map((m) => ({ nome: m.nome, celular: m.celular, cidade: m.cidade ?? m.cidadeTexto, temCarro: m.temCarro })),
      casas: e.casas.map((c) => ({
        numero: c.numero,
        nome: c.nome,
        endereco: c.endereco,
        bairro: c.bairro,
        cidade: c.cidade ?? c.cidadeTexto,
        celular: c.celular,
      })),
    })),
  );
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivoEquipes(missao.nome)}"`,
    },
  });
}
