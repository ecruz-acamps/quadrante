import { db } from "./db";
import { chaveVizinha, resolverCidade, type MapaApelidos, type Vizinhanca } from "./cidades";
import { formarEquipes, validarEquipe, type ServoEv, type TipoAvisoEquipe } from "./equipesEvangelizacao";
import {
  calcularCotas,
  limitesPorCarros,
  sortearCasas,
  validarCasa,
  type CasaSorteio,
  type EquipeSorteio,
  type ResultadoSorteio,
  type StatusCasa,
} from "./sorteioCasas";

const SETOR = "EVANGELIZAÇÃO";

export async function carregarMapaCidades(): Promise<{ mapa: MapaApelidos; viz: Vizinhanca }> {
  const [apelidos, pares] = await Promise.all([db.cidadeApelido.findMany(), db.cidadeVizinha.findMany()]);
  return {
    mapa: new Map(apelidos.map((a) => [a.apelido, a.cidadeId])),
    viz: new Set(pares.map((p) => chaveVizinha(p.cidadeId, p.vizinhaId))),
  };
}

export async function exigirDistribuicaoAberta(missaoId: number): Promise<void> {
  const m = await db.missao.findUnique({ where: { id: missaoId }, select: { evangelizacaoFechada: true } });
  if (!m) throw new Error("Missão não encontrada.");
  if (m.evangelizacaoFechada) throw new Error("Distribuição fechada.");
}

const servosElegiveis = (missaoId: number) =>
  db.servo.findMany({
    where: { missaoId, setor: SETOR, status: "ATIVO" },
    include: { pessoa: true },
    orderBy: { id: "asc" },
  });

export async function aplicarSugestaoEquipes(missaoId: number): Promise<{ equipes: number }> {
  await exigirDistribuicaoAberta(missaoId);
  const [{ mapa, viz }, servos] = await Promise.all([carregarMapaCidades(), servosElegiveis(missaoId)]);
  const entrada: ServoEv[] = servos.map((s) => ({
    id: s.id,
    cidadeId: resolverCidade(s.pessoa.cidade, mapa),
    temCarro: s.temCarro,
  }));
  const { equipes } = formarEquipes(entrada, viz);
  await db.$transaction(async (tx) => {
    // apagar as equipes solta membros e casas (SetNull); fixações perdem o sentido
    await tx.neocampista.updateMany({ where: { missaoId }, data: { casaFixada: false } });
    await tx.equipeEvangelizacao.deleteMany({ where: { missaoId } });
    for (let i = 0; i < equipes.length; i++) {
      const eq = await tx.equipeEvangelizacao.create({ data: { missaoId, nome: `Equipe ${i + 1}` } });
      await tx.servo.updateMany({ where: { id: { in: equipes[i] } }, data: { equipeEvangelizacaoId: eq.id } });
    }
  });
  return { equipes: equipes.length };
}

async function equipesParaSorteio(missaoId: number, mapa: MapaApelidos): Promise<EquipeSorteio[]> {
  const equipes = await db.equipeEvangelizacao.findMany({
    where: { missaoId },
    include: { servos: { where: { status: "ATIVO" }, include: { pessoa: true } } },
    orderBy: { id: "asc" },
  });
  return equipes
    .filter((e) => e.servos.length > 0)
    .map((e) => ({
      id: e.id,
      cidades: e.servos.map((s) => resolverCidade(s.pessoa.cidade, mapa)),
      carros: e.servos.filter((s) => s.temCarro).length,
    }));
}

export async function aplicarSorteio(
  missaoId: number,
  rng: () => number = Math.random
): Promise<ResultadoSorteio> {
  await exigirDistribuicaoAberta(missaoId);
  const { mapa, viz } = await carregarMapaCidades();
  const [equipes, fichas, todasEquipes] = await Promise.all([
    equipesParaSorteio(missaoId, mapa),
    db.neocampista.findMany({ where: { missaoId, situacao: "OK" }, orderBy: { numero: "asc" } }),
    db.equipeEvangelizacao.findMany({ where: { missaoId }, select: { id: true } }),
  ]);
  const equipeValida = new Set(todasEquipes.map((e) => e.id));
  const casas: CasaSorteio[] = fichas.map((f) => ({
    id: f.id,
    cidadeId: resolverCidade(f.cidade, mapa),
    bairro: f.bairro,
    fixadaEm: f.casaFixada && f.equipeEvangelizacaoId && equipeValida.has(f.equipeEvangelizacaoId) ? f.equipeEvangelizacaoId : null,
  }));
  const resultado = sortearCasas(equipes, casas, viz, rng);
  await db.$transaction(async (tx) => {
    await tx.neocampista.updateMany({
      where: { missaoId, OR: [{ casaFixada: false }, { equipeEvangelizacaoId: null }] },
      data: { equipeEvangelizacaoId: null, casaFixada: false },
    });
    for (const [fichaId, equipeId] of resultado.alocacao) {
      await tx.neocampista.update({ where: { id: fichaId }, data: { equipeEvangelizacaoId: equipeId } });
    }
  });
  return resultado;
}

export type MembroPainel = {
  id: number;
  nome: string;
  celular: string | null;
  cidadeId: number | null;
  cidade: string | null;
  cidadeTexto: string | null;
  temCarro: boolean;
};
export type CasaPainel = {
  id: number;
  numero: number;
  nome: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  cidadeTexto: string | null;
  celular: string | null;
  fixada: boolean;
  status: StatusCasa;
};

export async function carregarPainel(missaoId: number) {
  const { mapa, viz } = await carregarMapaCidades();
  const [missao, cidades, equipes, servosLivres, fichas, servosTodos] = await Promise.all([
    db.missao.findUnique({ where: { id: missaoId }, select: { evangelizacaoFechada: true } }),
    db.cidade.findMany({ orderBy: { nome: "asc" } }),
    db.equipeEvangelizacao.findMany({
      where: { missaoId },
      orderBy: { id: "asc" },
      include: {
        servos: { where: { status: "ATIVO" }, include: { pessoa: true }, orderBy: { id: "asc" } },
        casas: { where: { situacao: "OK" }, orderBy: { numero: "asc" } },
      },
    }),
    db.servo.findMany({
      where: { missaoId, setor: SETOR, status: "ATIVO", equipeEvangelizacaoId: null },
      include: { pessoa: true },
      orderBy: { id: "asc" },
    }),
    db.neocampista.findMany({ where: { missaoId, situacao: "OK" }, orderBy: { numero: "asc" } }),
    servosElegiveis(missaoId),
  ]);
  const nomeCidade = new Map(cidades.map((c) => [c.id, c.nome]));
  const membro = (s: (typeof servosTodos)[number]): MembroPainel => {
    const cidadeId = resolverCidade(s.pessoa.cidade, mapa);
    return {
      id: s.id,
      nome: s.pessoa.nome,
      celular: s.pessoa.celular,
      cidadeId,
      cidade: cidadeId ? nomeCidade.get(cidadeId) ?? null : null,
      cidadeTexto: s.pessoa.cidade,
      temCarro: s.temCarro,
    };
  };

  const painelEquipes = equipes.map((e) => {
    const membros = e.servos.map(membro);
    const sorteio: EquipeSorteio = { id: e.id, cidades: membros.map((x) => x.cidadeId) };
    const casas: CasaPainel[] = e.casas.map((f) => {
      const cidadeId = resolverCidade(f.cidade, mapa);
      return {
        id: f.id,
        numero: f.numero,
        nome: f.nome,
        endereco: f.endereco,
        bairro: f.bairro,
        cidade: cidadeId ? nomeCidade.get(cidadeId) ?? null : null,
        cidadeTexto: f.cidade,
        celular: f.celular,
        fixada: f.casaFixada,
        status: validarCasa(sorteio, cidadeId),
      };
    });
    const avisos: TipoAvisoEquipe[] = validarEquipe(
      membros.map((x) => ({ id: x.id, cidadeId: x.cidadeId, temCarro: x.temCarro })),
      viz
    );
    return { id: e.id, nome: e.nome, membros, avisos, casas, carros: membros.filter((x) => x.temCarro).length };
  });
  // casas por equipe na proporção dos carros; equipe com cidade de membro desconhecida fica fora (não recebe casas)
  const aptas = painelEquipes.filter((e) => !e.avisos.includes("CIDADE_DESCONHECIDA"));
  const totalAptas = aptas.reduce((n, e) => n + e.casas.length, 0);
  const carrosAptas = aptas.map((e) => e.carros);
  const cotas = calcularCotas(carrosAptas, totalAptas);
  const limites = limitesPorCarros(carrosAptas, totalAptas);
  const painelComCotas = painelEquipes.map((e) => {
    const i = aptas.findIndex((a) => a.id === e.id);
    return { ...e, cota: i >= 0 ? cotas[i] : 0, limite: i >= 0 ? limites[i] : 0 };
  });

  const pendencias = fichas
    .filter((f) => f.equipeEvangelizacaoId === null)
    .map((f) => ({
      id: f.id,
      numero: f.numero,
      nome: f.nome,
      cidadeTexto: f.cidade,
      bairro: f.bairro,
      motivo: (resolverCidade(f.cidade, mapa) === null ? "SEM_CIDADE" : "SEM_EQUIPE_PERMITIDA") as
        | "SEM_CIDADE"
        | "SEM_EQUIPE_PERMITIDA",
    }));

  const desconhecidas = new Map<string, { texto: string; fichas: number; servos: number }>();
  const somar = (texto: string | null, campo: "fichas" | "servos") => {
    const t = texto?.trim();
    if (!t || resolverCidade(t, mapa) !== null) return;
    const atual = desconhecidas.get(t) ?? { texto: t, fichas: 0, servos: 0 };
    atual[campo]++;
    desconhecidas.set(t, atual);
  };
  fichas.forEach((f) => somar(f.cidade, "fichas"));
  servosTodos.forEach((s) => somar(s.pessoa.cidade, "servos"));

  const casasPorCidade = new Map<string, number>();
  for (const f of fichas) {
    const id = resolverCidade(f.cidade, mapa);
    const nome = id ? nomeCidade.get(id)! : "(sem cidade reconhecida)";
    casasPorCidade.set(nome, (casasPorCidade.get(nome) ?? 0) + 1);
  }

  return {
    fechada: missao?.evangelizacaoFechada ?? false,
    cidades,
    equipes: painelComCotas,
    servosSemEquipe: servosLivres.map(membro),
    pendencias,
    cidadesDesconhecidas: [...desconhecidas.values()].sort((a, b) => b.fichas + b.servos - (a.fichas + a.servos)),
    equipesAcimaDoLimite: painelComCotas.filter((e) => e.limite > 0 && e.casas.length > e.limite).map((e) => e.id),
    casasPorCidade: [...casasPorCidade.entries()].sort((a, b) => b[1] - a[1]),
  };
}
