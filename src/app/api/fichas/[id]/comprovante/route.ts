import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { usuarioDaApi } from "@/lib/apiAuth";
import { acessoRegistros } from "@/lib/autorizacao";
import { db } from "@/lib/db";
import { oneDrive } from "@/lib/oneDrive";
import { extensaoDe, TAMANHO_MAXIMO } from "@/lib/fichaArquivos";
import { enviarComprovante, EXTENSOES_COMPROVANTE } from "@/lib/comprovante";

// Comprovante do PIX da ficha: vai para o OneDrive (<Missão>/Comprovantes PIX) e libera o "OK - PAGO".
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // a tela lê sempre JSON: um erro não previsto também volta como mensagem (e fica no registro do servidor)
  try {
    return await enviar(req, ctx);
  } catch (e) {
    console.error("Erro no envio da ficha:", e);
    return Response.json({ erro: `Erro no servidor: ${(e as Error).message ?? "desconhecido"}` }, { status: 500 });
  }
}

async function enviar(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await usuarioDaApi();
  if ("resposta" in auth) return auth.resposta;
  const { usuario } = auth;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || !(await acessoRegistros(usuario, ["ficha", id]))) {
    return Response.json({ erro: "Sem acesso a esta ficha." }, { status: 403 });
  }
  if (!(await db.integracaoOneDrive.findUnique({ where: { id: 1 } }))) {
    return Response.json({ erro: "O OneDrive não está conectado. Peça a um administrador (SUPER) para conectar em Configurações." }, { status: 409 });
  }
  let arquivo: File | null = null;
  try {
    const campo = (await req.formData()).get("arquivo");
    arquivo = campo instanceof File ? campo : null;
  } catch {
    return Response.json({ erro: `Não foi possível ler o envio. O limite é ${TAMANHO_MAXIMO / 1024 / 1024} MB.` }, { status: 400 });
  }
  if (!arquivo || arquivo.size === 0) return Response.json({ erro: "Escolha o arquivo do comprovante." }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) return Response.json({ erro: `O arquivo passa de ${TAMANHO_MAXIMO / 1024 / 1024} MB.` }, { status: 413 });
  if (!EXTENSOES_COMPROVANTE.includes(extensaoDe(arquivo.name))) {
    return Response.json({ erro: `Tipo de arquivo não aceito. Use: ${EXTENSOES_COMPROVANTE.join(", ")}.` }, { status: 400 });
  }
  try {
    const f = await enviarComprovante(id, arquivo.name, Buffer.from(await arquivo.arrayBuffer()), db, oneDrive(db));
    revalidatePath("/fichas");
    revalidatePath(`/fichas/${id}`);
    return Response.json({ ok: true, nome: f.comprovanteNome });
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 502 });
  }
}
