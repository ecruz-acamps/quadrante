import type { PrismaClient } from "@prisma/client";
import { TIPOS_PERGUNTA, type PerguntaForm, type TipoPergunta } from "./servirRespostas";

export type DadosPergunta = {
  titulo: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  opcoes: string[];
  permiteOutra: boolean;
};

type PerguntaAdmin = PerguntaForm & { ativa: boolean; ordem: number; temRespostas: boolean };

const ehEscolha = (t: string) => t === "ESCOLHA_UMA" || t === "ESCOLHA_VARIAS";

const ACAMPAMENTOS = [
  ...Array.from({ length: 23 }, (_, i) => `${i + 1}º Sênior`),
  "Sênior de Palhoça - São Francisco de Assis",
  "Sênior de São José - São José",
  "Sênior - São Padre Pio - Forania de Santo Amaro",
  "Sênior Geral (realizado fora do Sítio São Padre Pio)",
];

const SETORES = [
  "Evangelização", "Líder", "Cozinha", "Capela", "Manutenção", "Tropa", "Cantinho Mariano", "Teatro",
  "Animação", "Ligação", "Música", "Farmácia", "Secretaria", "Coordenação de Tropa",
  "Coordenação de Evangelização", "Coordenação de Líderes", "Coordenação de Farmácia",
  "Coordenação de Animação", "Coordenação de Cozinha", "Coordenação de Música",
  "Auxiliar da Coordenação de Missão", "Auxiliar de Líderes", "Nunca fui servo",
];

const PAROQUIAS = [
  "Paróquia Santo Amaro", "Paróquia São Francisco de Assis", "Paróquia São Sebastião Anitápolis",
  "Paróquia São Sebastião", "Paróquia Judas Tadeu e São João Batista",
  "Paróquia Sagrado Coração de Jesus - Paulo Lopes", "Paróquia Nossa Senhora da Imaculada Conceição",
  "Paróquia Nossa Senhora dos Navegantes e São Pedro", "Paróquia Sagrado Coração de Jesus - Leoberto Leal",
  "Paróquia Senhor Bom Jesus de Nazaré",
];

// as perguntas do Google Forms que este formulário substitui
const INICIAIS: (DadosPergunta)[] = [
  { titulo: "Data de nascimento", tipo: "DATA", obrigatoria: true, opcoes: [], permiteOutra: false },
  { titulo: "Você fez algum acampamento?", tipo: "SIM_NAO", obrigatoria: true, opcoes: [], permiteOutra: false },
  {
    titulo: "Você fez o Acampamento Sênior no Sítio São Padre Pio? Se sim, selecione qual acampamento",
    tipo: "ESCOLHA_UMA", obrigatoria: false, opcoes: ACAMPAMENTOS, permiteOutra: true,
  },
  { titulo: "Quais setores você já serviu?", tipo: "ESCOLHA_VARIAS", obrigatoria: false, opcoes: SETORES, permiteOutra: true },
  { titulo: "Selecione a paróquia em que você serve", tipo: "ESCOLHA_UMA", obrigatoria: true, opcoes: PAROQUIAS, permiteOutra: true },
  { titulo: "Participa de alguma pastoral?", tipo: "SIM_NAO", obrigatoria: true, opcoes: [], permiteOutra: false },
  { titulo: "Se sim, qual?", tipo: "TEXTO_CURTO", obrigatoria: false, opcoes: [], permiteOutra: false },
  { titulo: "Em que ano você começou a servir em sua paróquia?", tipo: "NUMERO", obrigatoria: false, opcoes: [], permiteOutra: false },
];

function paraBanco(d: DadosPergunta) {
  return {
    titulo: d.titulo,
    tipo: d.tipo,
    obrigatoria: d.obrigatoria,
    opcoes: ehEscolha(d.tipo) ? JSON.stringify(d.opcoes) : null,
    permiteOutra: ehEscolha(d.tipo) ? d.permiteOutra : false,
  };
}

export async function garantirPerguntasIniciais(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    if ((await tx.perguntaServir.count()) > 0) return;
    for (const [i, d] of INICIAIS.entries()) await tx.perguntaServir.create({ data: { ordem: i + 1, ...paraBanco(d) } });
  });
}

function opcoesDe(json: string | null): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function paraForm(p: { id: number; titulo: string; tipo: string; obrigatoria: boolean; opcoes: string | null; permiteOutra: boolean }): PerguntaForm {
  return {
    id: p.id,
    titulo: p.titulo,
    tipo: p.tipo as TipoPergunta,
    obrigatoria: p.obrigatoria,
    opcoes: opcoesDe(p.opcoes),
    permiteOutra: p.permiteOutra,
  };
}

export async function listarPerguntasAtivas(db: PrismaClient): Promise<PerguntaForm[]> {
  const ps = await db.perguntaServir.findMany({ where: { ativa: true }, orderBy: [{ ordem: "asc" }, { id: "asc" }] });
  return ps.map(paraForm);
}

// as respostas guardam `"perguntaId":<id>,` (primeira chave do objeto)
async function temRespostas(db: PrismaClient, perguntaId: number): Promise<boolean> {
  return (await db.candidato.count({ where: { respostas: { contains: `"perguntaId":${perguntaId},` } } })) > 0;
}

export async function listarPerguntasAdmin(db: PrismaClient): Promise<PerguntaAdmin[]> {
  const ps = await db.perguntaServir.findMany({ orderBy: [{ ordem: "asc" }, { id: "asc" }] });
  return Promise.all(ps.map(async (p) => ({ ...paraForm(p), ativa: p.ativa, ordem: p.ordem, temRespostas: await temRespostas(db, p.id) })));
}

function validar(d: DadosPergunta): { ok: true; dados: DadosPergunta } | { ok: false; erro: string } {
  const titulo = d.titulo.trim();
  if (!titulo || titulo.length > 200) return { ok: false, erro: "O título é obrigatório (até 200 caracteres)." };
  if (!TIPOS_PERGUNTA.includes(d.tipo)) return { ok: false, erro: "Tipo de pergunta inválido." };
  let opcoes: string[] = [];
  if (ehEscolha(d.tipo)) {
    opcoes = [...new Set(d.opcoes.map((o) => o.trim()).filter(Boolean))];
    if (opcoes.length === 0) return { ok: false, erro: "Informe ao menos uma opção." };
    if (opcoes.some((o) => o.length > 120)) return { ok: false, erro: "Cada opção pode ter até 120 caracteres." };
  }
  return { ok: true, dados: { ...d, titulo, opcoes } };
}

export async function criarPergunta(db: PrismaClient, d: DadosPergunta): Promise<{ ok: true; id: number } | { ok: false; erro: string }> {
  const v = validar(d);
  if (!v.ok) return v;
  const ultima = await db.perguntaServir.aggregate({ _max: { ordem: true } });
  const p = await db.perguntaServir.create({ data: { ordem: (ultima._max.ordem ?? 0) + 1, ...paraBanco(v.dados) } });
  return { ok: true, id: p.id };
}

export async function atualizarPergunta(db: PrismaClient, id: number, d: DadosPergunta): Promise<{ ok: true } | { ok: false; erro: string }> {
  const v = validar(d);
  if (!v.ok) return v;
  const atual = await db.perguntaServir.findUnique({ where: { id } });
  if (!atual) return { ok: false, erro: "Pergunta não encontrada." };
  if (atual.tipo !== v.dados.tipo && (await temRespostas(db, id))) {
    return { ok: false, erro: "Esta pergunta já tem respostas: não dá para trocar o tipo. Crie outra e desative esta." };
  }
  await db.perguntaServir.update({ where: { id }, data: paraBanco(v.dados) });
  return { ok: true };
}

export async function moverPergunta(db: PrismaClient, id: number, direcao: "cima" | "baixo"): Promise<void> {
  const ps = await db.perguntaServir.findMany({ orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true } });
  const i = ps.findIndex((p) => p.id === id);
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= ps.length) return;
  [ps[i], ps[j]] = [ps[j], ps[i]];
  await db.$transaction(ps.map((p, k) => db.perguntaServir.update({ where: { id: p.id }, data: { ordem: k + 1 } })));
}

export async function definirPerguntaAtiva(db: PrismaClient, id: number, ativa: boolean): Promise<void> {
  await db.perguntaServir.update({ where: { id }, data: { ativa } });
}
