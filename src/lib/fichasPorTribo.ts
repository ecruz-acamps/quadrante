// "Baixar fichas por tribo" (Evangelização): as fichas preenchidas que estão no OneDrive, num zip com uma pasta
// por cor de tribo (e "SEM TRIBO"). Os arquivos são baixados um de cada vez e seguem direto para o zip.
import type { Arquivos } from "./oneDrive";
import { corDaTribo } from "./fichaArquivos";
import { caminhoNoZip, type EntradaZip } from "./zipStream";

export type FichaParaZip = {
  numero: number;
  nome: string;
  tribo: { nome: string } | null;
  arquivos: { nome: string; driveId: string; itemId: string }[];
};

export const PASTA_SEM_TRIBO = "SEM TRIBO";
export const NOME_FALTARAM = "LEIA-ME - arquivos que faltaram.txt";

export function pastaDaFicha(f: Pick<FichaParaZip, "tribo">) {
  return f.tribo ? corDaTribo(f.tribo.nome) : PASTA_SEM_TRIBO;
}

// tribos em ordem de cor e "SEM TRIBO" no fim; dentro da pasta, pelo número da ficha
export function ordenarParaZip<T extends FichaParaZip>(fichas: T[]): T[] {
  return [...fichas].sort((a, b) => {
    const pa = pastaDaFicha(a), pb = pastaDaFicha(b);
    if (pa !== pb) return pa === PASTA_SEM_TRIBO ? 1 : pb === PASTA_SEM_TRIBO ? -1 : pa.localeCompare(pb, "pt-BR");
    return a.numero - b.numero;
  });
}

export async function* entradasFichasPorTribo(fichas: FichaParaZip[], od: Arquivos): AsyncGenerator<EntradaZip> {
  const usados = new Set<string>();
  const faltaram: string[] = [];
  for (const f of ordenarParaZip(fichas)) {
    for (const a of f.arquivos) {
      let caminho = caminhoNoZip(pastaDaFicha(f), a.nome);
      // nome repetido na mesma pasta (raro): acrescenta o número da ficha
      if (usados.has(caminho.toLowerCase())) caminho = caminhoNoZip(pastaDaFicha(f), `${f.numero} - ${a.nome}`);
      usados.add(caminho.toLowerCase());
      let dados: Buffer;
      try {
        dados = await od.baixar({ driveId: a.driveId, id: a.itemId });
      } catch (e) {
        faltaram.push(`${caminho}: ${(e as Error).message}`);
        continue;
      }
      yield { nome: caminho, dados: new Uint8Array(dados) };
    }
  }
  if (faltaram.length) {
    const texto = [
      "Estes arquivos não puderam ser baixados do OneDrive e ficaram fora do zip.",
      "Confira as fichas no sistema (aviso \"Fora de ordem no OneDrive\") e baixe de novo.",
      "",
      ...faltaram,
      "",
    ].join("\r\n");
    yield { nome: NOME_FALTARAM, dados: new Uint8Array(Buffer.from(texto, "utf8")) };
  }
}

export function nomeZip(missaoNome: string) {
  const slug = missaoNome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `fichas-por-tribo-${slug || "missao"}.zip`;
}
