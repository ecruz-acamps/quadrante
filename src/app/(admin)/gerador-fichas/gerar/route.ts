import { requireRole } from "@/lib/auth";
import { gerarZipFichas } from "@/lib/fichaPdf";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await requireRole("SUPER");
  const q = new URL(req.url).searchParams;
  const missao = String(q.get("missao") ?? "").trim();
  const data = String(q.get("data") ?? "").trim();
  const saida = String(q.get("saida") ?? "").trim();
  const encerramento = String(q.get("encerramento") ?? "").trim();
  const valor = Number(q.get("valor"));
  const pix = String(q.get("pix") ?? "").trim();
  const contato = String(q.get("contato") ?? "").trim();
  const dataOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  if (!dataOk(saida) || !dataOk(encerramento) || !(valor > 0 && valor < 100000) || !pix || !contato || pix.length > 120 || contato.length > 120) {
    return new Response("Informe saída, encerramento, valor, PIX e contato.", { status: 400 });
  }
  const inicio = Math.floor(Number(q.get("inicio") ?? 1));
  const quantidade = Math.floor(Number(q.get("quantidade")));
  if (!/^\d{1,3}$/.test(missao) || !data || data.length > 80) return new Response("Dados inválidos.", { status: 400 });
  if (!(inicio >= 1 && inicio <= 9999) || !(quantidade >= 1 && quantidade <= 300)) {
    return new Response("Quantidade deve ser de 1 a 300.", { status: 400 });
  }
  const zip = await gerarZipFichas({ missao, data, saida, encerramento, valor, pix, contato, inicio, quantidade });
  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="fichas-missao-${missao}.zip"`,
    },
  });
}
