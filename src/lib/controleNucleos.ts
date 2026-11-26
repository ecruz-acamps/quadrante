// Controle por núcleo: quantas fichas cada núcleo recebeu x quantas já foram cadastradas no sistema.
import { NUCLEOS } from "./nucleos";

export type LinhaNucleo = {
  nucleo: string;
  recebidas: number;
  cadastradas: number;
  faltam: number; // recebidas - cadastradas, nunca negativo
  aMais: number; // cadastradas além das recebidas (provável núcleo errado numa ficha, ou recebidas a atualizar)
  foraDaLista: boolean; // núcleo antigo, que aparece só porque há fichas com ele
};

export function resumoNucleos(recebidas: Map<string, number>, cadastradas: Map<string, number>) {
  const nomes = [...NUCLEOS, ...[...cadastradas.keys()].filter((n) => !(NUCLEOS as readonly string[]).includes(n)).sort()];
  const linhas: LinhaNucleo[] = nomes.map((nucleo) => {
    const r = recebidas.get(nucleo) ?? 0;
    const c = cadastradas.get(nucleo) ?? 0;
    return { nucleo, recebidas: r, cadastradas: c, faltam: Math.max(r - c, 0), aMais: Math.max(c - r, 0), foraDaLista: !(NUCLEOS as readonly string[]).includes(nucleo) };
  });
  const soma = (k: "recebidas" | "cadastradas" | "faltam" | "aMais") => linhas.reduce((n, l) => n + l[k], 0);
  return { linhas, total: { recebidas: soma("recebidas"), cadastradas: soma("cadastradas"), faltam: soma("faltam"), aMais: soma("aMais") } };
}
