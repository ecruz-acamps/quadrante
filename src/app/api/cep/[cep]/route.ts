import { requireUser } from "@/lib/auth";
import { buscarCepServicos, cepDeTexto } from "@/lib/cep";

// Busca de CEP para a ficha, feita pelo servidor (não depende do navegador alcançar o ViaCEP; tem a BrasilAPI de reserva).
export async function GET(_req: Request, { params }: { params: Promise<{ cep: string }> }) {
  await requireUser();
  const cep = cepDeTexto((await params).cep);
  if (!cep) return Response.json({ tipo: "invalido" }, { status: 400 });
  const r = await buscarCepServicos(cep);
  return Response.json(r, { headers: { "Cache-Control": "private, max-age=86400" } });
}
