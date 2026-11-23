import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { acessoRegistros } from "@/lib/autorizacao";
import { db } from "@/lib/db";
import { oneDrive } from "@/lib/oneDrive";
import { enviarFichaPreenchida, EXTENSOES, extensaoDe, TAMANHO_MAXIMO } from "@/lib/fichaArquivos";

// Upload da ficha preenchida (botão "Fazer upload da ficha preenchida"): vai para o OneDrive com o nome original
// e em seguida é renomeada para "NNN - Nome[ - COR]"; com tribo, ganha também a cópia na pasta da cor.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || !(await acessoRegistros(usuario, ["ficha", id]))) {
    return Response.json({ erro: "Sem acesso a esta ficha." }, { status: 403 });
  }
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) {
    return Response.json({ erro: "O OneDrive não está conectado. Peça a um administrador (SUPER) para conectar em Configurações." }, { status: 409 });
  }

  let arquivo: File | null = null;
  try {
    const dados = await req.formData();
    const campo = dados.get("arquivo");
    arquivo = campo instanceof File ? campo : null;
  } catch {
    return Response.json({ erro: `Não foi possível ler o envio. O limite é ${TAMANHO_MAXIMO / 1024 / 1024} MB.` }, { status: 400 });
  }
  if (!arquivo || arquivo.size === 0) return Response.json({ erro: "Escolha o arquivo da ficha." }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) {
    return Response.json({ erro: `O arquivo passa de ${TAMANHO_MAXIMO / 1024 / 1024} MB.` }, { status: 413 });
  }
  if (!EXTENSOES.includes(extensaoDe(arquivo.name))) {
    return Response.json({ erro: `Tipo de arquivo não aceito. Use: ${EXTENSOES.join(", ")}.` }, { status: 400 });
  }

  try {
    const r = await enviarFichaPreenchida(id, arquivo.name, Buffer.from(await arquivo.arrayBuffer()), db, oneDrive(db));
    revalidatePath("/fichas");
    revalidatePath(`/fichas/${id}`);
    const f = await db.neocampista.findUnique({ where: { id }, select: { arquivoNome: true, arquivoUrl: true } });
    // r.ok false: o arquivo subiu, mas renomear ou copiar para a tribo falhou (fica registrado e dá para tentar de novo)
    return Response.json({ ok: true, nome: f?.arquivoNome, url: f?.arquivoUrl, aviso: r.ok ? undefined : r.erro });
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 502 });
  }
}
