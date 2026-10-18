import { saoVizinhas, type Vizinhanca } from "./cidades";

// carros: quantos membros têm carro; define a cota de casas (omitido = 1, divisão igual)
export type EquipeSorteio = { id: number; cidades: (number | null)[]; carros?: number };
export type CasaSorteio = {
  id: number;
  cidadeId: number | null;
  bairro: string | null;
  fixadaEm: number | null;
};
export type StatusCasa = "OK" | "IMPEDIDA" | "CIDADE_DESCONHECIDA";
export type ResultadoSorteio = {
  alocacao: Map<number, number>;
  pendencias: { casaId: number; motivo: "SEM_CIDADE" | "SEM_EQUIPE_PERMITIDA" }[];
  equipesAcimaDoLimite: number[];
};

// Cota de casas por equipe, na proporção dos carros (decisão da coordenação da Evangelização).
// Maior resto: a soma das cotas é sempre o total. Sem nenhum carro informado, divide igualmente.
export function calcularCotas(carros: number[], total: number): number[] {
  if (carros.length === 0) return [];
  const soma = carros.reduce((a, b) => a + b, 0);
  const pesos = soma > 0 ? carros : carros.map(() => 1);
  const somaPesos = soma > 0 ? soma : carros.length;
  const exatas = pesos.map((w) => (total * w) / somaPesos);
  const cotas = exatas.map(Math.floor);
  let faltam = total - cotas.reduce((a, b) => a + b, 0);
  const porResto = exatas
    .map((x, i) => ({ i, resto: x - Math.floor(x), peso: pesos[i] }))
    .filter((x) => x.peso > 0)
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; faltam > 0 && porResto.length; k++, faltam--) cotas[porResto[k % porResto.length].i]++;
  return cotas;
}

// Parcela fracionária de cada equipe (total * peso / soma dos pesos); o teto dela é o limite sem sobrar casa.
function parcelasPorCarros(carros: number[], total: number): number[] {
  const soma = carros.reduce((a, b) => a + b, 0);
  const pesos = soma > 0 ? carros : carros.map(() => 1);
  const somaPesos = soma > 0 ? soma : carros.length;
  return pesos.map((w) => (somaPesos ? (total * w) / somaPesos : 0));
}

export function limitesPorCarros(carros: number[], total: number): number[] {
  return parcelasPorCarros(carros, total).map((x) => Math.ceil(x - 1e-9));
}

export function validarCasa(equipe: EquipeSorteio, casaCidadeId: number | null): StatusCasa {
  if (casaCidadeId == null || equipe.cidades.some((c) => c == null)) return "CIDADE_DESCONHECIDA";
  if (equipe.cidades.includes(casaCidadeId)) return "IMPEDIDA";
  return "OK";
}

const chaveBairro = (c: CasaSorteio) => (c.bairro ?? "").trim().toLowerCase();

function embaralhar<T>(lista: T[], rng: () => number): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function sortearCasas(
  equipes: EquipeSorteio[],
  casas: CasaSorteio[],
  viz: Vizinhanca,
  rng: () => number = Math.random
): ResultadoSorteio {
  const alocacao = new Map<number, number>();
  const pendencias: ResultadoSorteio["pendencias"] = [];
  const elegiveis = equipes.filter((e) => e.cidades.every((c) => c != null));
  const cotaDe = new Map<number, number>(); // limite (teto da parcela)
  const parcelaDe = new Map<number, number>();
  const carga = new Map(equipes.map((e) => [e.id, 0]));
  const casasDaEquipe = new Map(equipes.map((e) => [e.id, [] as CasaSorteio[]]));

  const colocar = (c: CasaSorteio, equipeId: number) => {
    alocacao.set(c.id, equipeId);
    carga.set(equipeId, (carga.get(equipeId) ?? 0) + 1);
    casasDaEquipe.get(equipeId)?.push(c);
  };

  const livres: CasaSorteio[] = [];
  for (const c of casas) {
    if (c.fixadaEm != null) colocar(c, c.fixadaEm);
    else if (c.cidadeId == null) pendencias.push({ casaId: c.id, motivo: "SEM_CIDADE" });
    else livres.push(c);
  }

  if (elegiveis.length === 0) {
    for (const c of livres) pendencias.push({ casaId: c.id, motivo: "SEM_EQUIPE_PERMITIDA" });
  } else {
    const fixadasElegiveis = elegiveis.reduce((n, e) => n + (carga.get(e.id) ?? 0), 0);
    const total = fixadasElegiveis + livres.length;
    const carrosElegiveis = elegiveis.map((e) => e.carros ?? 1);
    const parcelas = parcelasPorCarros(carrosElegiveis, total);
    limitesPorCarros(carrosElegiveis, total).forEach((l, i) => {
      cotaDe.set(elegiveis[i].id, l);
      parcelaDe.set(elegiveis[i].id, parcelas[i]);
    });

    // grupos cidade+bairro andam juntos; as cidades mais restritas (menos equipes permitidas) vão primeiro
    const grupos = new Map<string, CasaSorteio[]>();
    for (const c of livres) {
      const k = `${c.cidadeId}|${chaveBairro(c)}`;
      grupos.set(k, [...(grupos.get(k) ?? []), c]);
    }
    const permitidas = (cidadeId: number) =>
      elegiveis.filter((e) => validarCasa(e, cidadeId) === "OK").length;
    const ordem = embaralhar([...grupos.values()], rng)
      .map((g) => embaralhar(g, rng))
      .sort((a, b) => permitidas(a[0].cidadeId!) - permitidas(b[0].cidadeId!))
      .flat();

    for (const c of ordem) {
      const permitidasEq = elegiveis.filter((e) => validarCasa(e, c.cidadeId) === "OK");
      if (permitidasEq.length === 0) {
        pendencias.push({ casaId: c.id, motivo: "SEM_EQUIPE_PERMITIDA" });
        continue;
      }
      // equilíbrio na proporção da cota (prioridade 2) vem antes de vizinhança e bairro:
      // só recebem as equipes com menor proporção carga/cota; passou da cota de todas, pega a menos cheia
      const cota = (e: EquipeSorteio) => cotaDe.get(e.id) ?? 0;
      const proporcao = (e: EquipeSorteio) => carga.get(e.id)! / Math.max(parcelaDe.get(e.id) ?? 0, 0.5);
      const comVaga = permitidasEq.filter((e) => carga.get(e.id)! < cota(e));
      const base = comVaga.length ? comVaga : permitidasEq.filter((e) => cota(e) > 0).length ? permitidasEq.filter((e) => cota(e) > 0) : permitidasEq;
      const menor = Math.min(...base.map(proporcao));
      const candidatas = base.filter((e) => proporcao(e) <= menor + 1e-9);
      const pontuada = candidatas.map((e) => {
        const mesmas = casasDaEquipe.get(e.id)!;
        return {
          e,
          vizinha: e.cidades.some((m) => saoVizinhas(viz, m, c.cidadeId)) ? 1 : 0,
          mesmaCidade: mesmas.some((o) => o.cidadeId === c.cidadeId) ? 1 : 0,
          mesmoBairro:
            chaveBairro(c) && mesmas.some((o) => o.cidadeId === c.cidadeId && chaveBairro(o) === chaveBairro(c)) ? 1 : 0,
          carga: carga.get(e.id)!,
          sorte: rng(),
        };
      });
      pontuada.sort(
        (a, b) =>
          b.vizinha - a.vizinha ||
          b.mesmoBairro - a.mesmoBairro ||
          b.mesmaCidade - a.mesmaCidade ||
          a.carga - b.carga ||
          a.sorte - b.sorte
      );
      colocar(c, pontuada[0].e.id);
    }
  }

  // acima da cota: sobrou casa só por causa do impedimento de cidade
  const equipesAcimaDoLimite = equipes
    .filter((e) => cotaDe.has(e.id) && (carga.get(e.id) ?? 0) > cotaDe.get(e.id)!)
    .map((e) => e.id);
  return { alocacao, pendencias, equipesAcimaDoLimite };
}
