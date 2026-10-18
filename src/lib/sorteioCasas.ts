import { saoVizinhas, type Vizinhanca } from "./cidades";

export type EquipeSorteio = { id: number; cidades: (number | null)[] };
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

const LIMITE_POR_EQUIPE = 4;

export function validarCasa(equipe: EquipeSorteio, casaCidadeId: number | null): StatusCasa {
  if (casaCidadeId == null || equipe.cidades.some((c) => c == null)) return "CIDADE_DESCONHECIDA";
  if (equipe.cidades.includes(casaCidadeId)) return "IMPEDIDA";
  return "OK";
}

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
    const teto = Math.ceil((fixadasElegiveis + livres.length) / elegiveis.length);

    // grupos cidade+bairro andam juntos; as cidades mais restritas (menos equipes permitidas) vão primeiro
    const grupos = new Map<string, CasaSorteio[]>();
    for (const c of livres) {
      const k = `${c.cidadeId}|${(c.bairro ?? "").trim().toLowerCase()}`;
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
      const menor = Math.min(...permitidasEq.map((e) => carga.get(e.id)!));
      let candidatas = permitidasEq.filter(
        (e) => carga.get(e.id)! < teto && carga.get(e.id)! <= menor + 1
      );
      if (candidatas.length === 0) candidatas = permitidasEq.filter((e) => carga.get(e.id)! === menor);
      const pontuada = candidatas.map((e) => {
        const mesmas = casasDaEquipe.get(e.id)!;
        return {
          e,
          vizinha: e.cidades.some((m) => saoVizinhas(viz, m, c.cidadeId)) ? 1 : 0,
          mesmaCidade: mesmas.some((o) => o.cidadeId === c.cidadeId) ? 1 : 0,
          mesmoBairro: c.bairro && mesmas.some((o) => o.bairro === c.bairro) ? 1 : 0,
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

  const equipesAcimaDoLimite = equipes
    .filter((e) => (carga.get(e.id) ?? 0) > LIMITE_POR_EQUIPE)
    .map((e) => e.id);
  return { alocacao, pendencias, equipesAcimaDoLimite };
}
