import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { guardarAcesso } from "@/lib/guardaRestauracao";
import { iniciarRestauracao, limparTentativas } from "@/lib/codigoRestauracao";
import { prepararBackup, aplicarBackup, migrarComPrisma, ErroRestauracao } from "@/lib/restaurarBackup";
import { agendarReinicio } from "@/lib/reiniciar";

const TAMANHO_MAX = 200 * 1024 * 1024;

function erro(status: number, mensagem: string) {
  return Response.json({ erro: mensagem }, { status });
}

// Restaura o backup do Drive (.tar.gz.gpg) num sistema vazio. Protegido por código de uso único.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return erro(400, "Envio inválido.");

  const bloqueio = await guardarAcesso(String(form.get("codigo") ?? ""));
  if (bloqueio) return bloqueio;

  const arquivo = form.get("arquivo");
  const senha = String(form.get("senha") ?? "");
  if (!(arquivo instanceof File) || arquivo.size === 0) return erro(400, "Escolha o arquivo de backup.");
  if (arquivo.size > TAMANHO_MAX) return erro(400, "O arquivo é grande demais para ser um backup do Quadrante.");
  if (!senha) return erro(400, "Informe a senha do backup.");

  const liberar = iniciarRestauracao();
  if (!liberar) return erro(409, "Já existe uma restauração em andamento.");

  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "qd-upload-"));
  let preparadoPasta: string | undefined;
  try {
    const cifrado = path.join(temp, "backup.tar.gz.gpg");
    await fs.writeFile(cifrado, Buffer.from(await arquivo.arrayBuffer()));
    const preparado = await prepararBackup(cifrado, senha);
    preparadoPasta = preparado.pasta;
    await aplicarBackup(preparado, {
      appDir: process.cwd(),
      desconectar: () => db.$disconnect(),
      migrar: migrarComPrisma(process.cwd()),
    });
    limparTentativas();
    agendarReinicio();
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ErroRestauracao) return erro(400, err.message);
    console.error("Erro na restauração do backup:", err);
    return erro(500, "Não foi possível restaurar o backup. Veja o registro do servidor.");
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
    if (preparadoPasta) await fs.rm(preparadoPasta, { recursive: true, force: true });
    liberar();
  }
}
