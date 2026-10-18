import { saoVizinhas, type Vizinhanca } from "./cidades";

export type ServoEv = { id: number; cidadeId: number | null; temCarro: boolean };
export type TipoAvisoEquipe = "SEM_CARRO" | "TAMANHO" | "CIDADE_DESCONHECIDA" | "NAO_VIZINHAS";

export function validarEquipe(membros: ServoEv[], viz: Vizinhanca): TipoAvisoEquipe[] {
  const avisos: TipoAvisoEquipe[] = [];
  if (membros.length !== 3) avisos.push("TAMANHO");
  if (!membros.some((m) => m.temCarro)) avisos.push("SEM_CARRO");
  if (membros.some((m) => m.cidadeId == null)) avisos.push("CIDADE_DESCONHECIDA");
  const naoVizinhas = membros.some((a, i) =>
    membros.slice(i + 1).some(
      (b) =>
        a.cidadeId != null &&
        b.cidadeId != null &&
        a.cidadeId !== b.cidadeId &&
        !saoVizinhas(viz, a.cidadeId, b.cidadeId)
    )
  );
  if (naoVizinhas) avisos.push("NAO_VIZINHAS");
  return avisos;
}

function embaralhar<T>(lista: T[], rng: () => number): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Percorre as cidades pela vizinhança (começa pela maior) para servos de cidades próximas ficarem seguidos.
function ordenarPorCidade(servos: ServoEv[], viz: Vizinhanca, rng: () => number): ServoEv[] {
  const grupos = new Map<number, ServoEv[]>();
  for (const s of servos) {
    const g = grupos.get(s.cidadeId!) ?? [];
    g.push(s);
    grupos.set(s.cidadeId!, g);
  }
  const maiorPrimeiro = (a: number, b: number) =>
    grupos.get(b)!.length - grupos.get(a)!.length || a - b;
  const restantes = new Set(grupos.keys());
  const ordem: ServoEv[] = [];
  while (restantes.size) {
    const inicio = [...restantes].sort(maiorPrimeiro)[0];
    const fila = [inicio];
    restantes.delete(inicio);
    while (fila.length) {
      const c = fila.shift()!;
      ordem.push(...embaralhar(grupos.get(c)!, rng));
      const vizinhas = [...restantes].filter((o) => saoVizinhas(viz, c, o)).sort(maiorPrimeiro);
      for (const v of vizinhas) {
        restantes.delete(v);
        fila.push(v);
      }
    }
  }
  return ordem;
}

function cortar(ordem: ServoEv[]): ServoEv[][] {
  const n = ordem.length;
  if (n === 0) return [];
  const k = Math.max(1, Math.floor(n / 3));
  const sobra = n - 3 * k;
  if (sobra < 0 || sobra > k) {
    // 1 ou 2 servos, ou sobra que não cabe como 4º membro (n=5): a última equipe fica menor e é avisada
    const equipes = Array.from({ length: k }, (_, i) => ordem.slice(3 * i, 3 * i + 3));
    const resto = ordem.slice(3 * k);
    return resto.length ? [...equipes.slice(0, k), resto] : equipes;
  }
  const equipes: ServoEv[][] = [];
  let pos = 0;
  for (let i = 0; i < k; i++) {
    const tam = i >= k - sobra ? 4 : 3;
    equipes.push(ordem.slice(pos, pos + tam));
    pos += tam;
  }
  return equipes;
}

// Troca um servo sem carro de cada equipe sem carro por um carro de equipe com carro sobrando (a mais próxima na ordem).
function distribuirCarros(equipes: ServoEv[][]) {
  for (let i = 0; i < equipes.length; i++) {
    if (equipes[i].some((m) => m.temCarro)) continue;
    const doador = equipes
      .map((e, j) => ({ j, e }))
      .filter(({ j, e }) => j !== i && e.filter((m) => m.temCarro).length >= 2)
      .sort((a, b) => Math.abs(a.j - i) - Math.abs(b.j - i))[0];
    if (!doador) continue;
    const carro = doador.e.find((m) => m.temCarro)!;
    const semCarro = equipes[i][equipes[i].length - 1];
    equipes[i][equipes[i].length - 1] = carro;
    doador.e[doador.e.indexOf(carro)] = semCarro;
  }
}

export function formarEquipes(
  servos: ServoEv[],
  viz: Vizinhanca,
  rng: () => number = Math.random
): { equipes: number[][] } {
  const conhecidos = servos.filter((s) => s.cidadeId != null);
  const desconhecidos = servos.filter((s) => s.cidadeId == null);
  const comCidade = cortar(ordenarPorCidade(conhecidos, viz, rng));
  const semCidade = cortar(embaralhar(desconhecidos, rng));
  distribuirCarros(comCidade);
  distribuirCarros(semCidade);
  return { equipes: [...comCidade, ...semCidade].map((e) => e.map((s) => s.id)) };
}
