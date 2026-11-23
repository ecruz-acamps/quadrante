// Backup no OneDrive (pasta "Backups" dentro da pasta raiz do Quadrante), usado pelo backup diário
// (scripts/backup-to-drive.ts) e pelo teste de restauração (scripts/testar-restauracao.ts).
import fs from "node:fs/promises";
import type { Arquivos, Item, Ref } from "./oneDrive";

export const PASTA_BACKUPS = ["Backups"];
const PREFIXO = "quadrante-backup-";

export function pastaBackups(arquivos: Arquivos): Promise<Ref> {
  return arquivos.garantirPasta(PASTA_BACKUPS);
}

export async function enviarBackup(arquivos: Arquivos, pasta: Ref, caminho: string, nome: string): Promise<Item> {
  return arquivos.enviar(pasta, nome, await fs.readFile(caminho), "replace"); // o envio confere o tamanho guardado
}

// backups do Quadrante na pasta, do mais antigo para o mais novo (o nome traz data e hora)
export async function listarBackups(arquivos: Arquivos, pasta: Ref): Promise<Item[]> {
  return (await arquivos.listar(pasta)).filter((a) => a.name.startsWith(PREFIXO)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function baixarBackup(arquivos: Arquivos, item: Ref, destino: string) {
  await fs.writeFile(destino, await arquivos.baixar(item));
}

// quais arquivos (do mais antigo) passam do limite de retenção
export function excedentes<T>(ordenadosDoMaisAntigo: T[], retencao: number): T[] {
  return ordenadosDoMaisAntigo.slice(0, Math.max(0, ordenadosDoMaisAntigo.length - retencao));
}
