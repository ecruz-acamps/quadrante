// Operações da Evangelização. O id vem do navegador: a missão do registro vem sempre do banco.
// Ficam fora de actionsEvangelizacao.ts ("use server") para poderem ser testadas sem sessão.
import { db } from "./db";
import { exigirMissao, exigirRegistros } from "./autorizacao";
import { normalizarCidade } from "./cidades";
import { aplicarSorteio, aplicarSugestaoEquipes, exigirDistribuicaoAberta } from "./evangelizacaoDados";

type Usuario = { id: number; role: string };

const SEM_PERMISSAO = "Sem permissão para este registro.";
const inteiroPositivo = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

async function missaoDaEquipe(equipeId: number): Promise<number> {
  if (!inteiroPositivo(equipeId)) throw new Error(SEM_PERMISSAO);
  const e = await db.equipeEvangelizacao.findUnique({ where: { id: equipeId }, select: { missaoId: true } });
  if (!e) throw new Error(SEM_PERMISSAO);
  return e.missaoId;
}

// missão do registro (já conferida) tem de ser a mesma da equipe de destino
async function exigirEquipeDaMissao(equipeId: number, missaoId: number) {
  if (!inteiroPositivo(equipeId)) throw new Error(SEM_PERMISSAO);
  const e = await db.equipeEvangelizacao.findUnique({ where: { id: equipeId }, select: { missaoId: true } });
  if (!e) throw new Error(SEM_PERMISSAO);
  if (e.missaoId !== missaoId) throw new Error("Equipe de outra missão.");
}

async function abrir(user: Usuario, missaoId: number) {
  await exigirMissao(user, missaoId);
  await exigirDistribuicaoAberta(missaoId);
}

async function missaoDoServo(user: Usuario, servoId: number): Promise<number> {
  await exigirRegistros(user, ["servo", servoId]);
  const s = await db.servo.findUniqueOrThrow({ where: { id: servoId }, select: { missaoId: true } });
  return s.missaoId;
}

export async function marcarTemCarro(user: Usuario, servoId: number, temCarro: boolean) {
  const missaoId = await missaoDoServo(user, servoId);
  await exigirDistribuicaoAberta(missaoId);
  await db.servo.update({ where: { id: servoId }, data: { temCarro: Boolean(temCarro) } });
}

export async function sugerirEquipes(user: Usuario, missaoId: number) {
  await abrir(user, missaoId);
  return aplicarSugestaoEquipes(missaoId);
}

export async function criarEquipe(user: Usuario, missaoId: number) {
  await abrir(user, missaoId);
  const n = await db.equipeEvangelizacao.count({ where: { missaoId } });
  await db.equipeEvangelizacao.create({ data: { missaoId, nome: `Equipe ${n + 1}`, manual: true } });
}

export async function apagarEquipe(user: Usuario, equipeId: number) {
  const missaoId = await missaoDaEquipe(equipeId);
  await abrir(user, missaoId);
  await db.equipeEvangelizacao.delete({ where: { id: equipeId } });
}

export async function moverServoEquipe(user: Usuario, servoId: number, equipeId: number | null) {
  const missaoId = await missaoDoServo(user, servoId);
  await exigirDistribuicaoAberta(missaoId);
  if (equipeId !== null) await exigirEquipeDaMissao(equipeId, missaoId);
  const atual = await db.servo.findUniqueOrThrow({ where: { id: servoId }, select: { equipeEvangelizacaoId: true } });
  const mexidas = [atual.equipeEvangelizacaoId, equipeId].filter((x): x is number => x !== null);
  // mexer na composição à mão trava as equipes envolvidas: "Sugerir equipes" não as refaz
  await db.$transaction([
    db.servo.update({ where: { id: servoId }, data: { equipeEvangelizacaoId: equipeId } }),
    db.equipeEvangelizacao.updateMany({ where: { id: { in: mexidas } }, data: { manual: true } }),
  ]);
}

export async function rodarSorteio(user: Usuario, missaoId: number) {
  await abrir(user, missaoId);
  return aplicarSorteio(missaoId);
}

export async function moverCasa(user: Usuario, fichaId: number, equipeId: number | null) {
  await exigirRegistros(user, ["ficha", fichaId]);
  const f = await db.neocampista.findUniqueOrThrow({ where: { id: fichaId }, select: { missaoId: true } });
  await exigirDistribuicaoAberta(f.missaoId);
  if (equipeId !== null) await exigirEquipeDaMissao(equipeId, f.missaoId);
  // soltar a casa (null) desfaz a fixação; mover para uma equipe fixa a escolha manual
  await db.neocampista.update({
    where: { id: fichaId },
    data: { equipeEvangelizacaoId: equipeId, casaFixada: equipeId !== null },
  });
}

export async function limparFixacoes(user: Usuario, missaoId: number) {
  await abrir(user, missaoId);
  await db.neocampista.updateMany({ where: { missaoId }, data: { casaFixada: false } });
}

export async function fecharDistribuicao(user: Usuario, missaoId: number) {
  await exigirMissao(user, missaoId);
  await db.missao.update({ where: { id: missaoId }, data: { evangelizacaoFechada: true } });
}

export async function reabrirDistribuicao(user: Usuario, missaoId: number) {
  if (user.role !== "SUPER") throw new Error("Só o SUPER reabre a distribuição.");
  await exigirMissao(user, missaoId);
  await db.missao.update({ where: { id: missaoId }, data: { evangelizacaoFechada: false } });
}

// ---------- cidades (dados globais, valem em qualquer estado da distribuição) ----------
export async function associarApelidoCidade(texto: string, cidadeId: number) {
  const apelido = normalizarCidade(String(texto ?? ""));
  if (!apelido) throw new Error("Texto vazio.");
  if (!inteiroPositivo(cidadeId) || !(await db.cidade.findUnique({ where: { id: cidadeId } }))) {
    throw new Error("Cidade inválida (não existe).");
  }
  const atual = await db.cidadeApelido.findUnique({ where: { apelido } });
  if (atual && atual.cidadeId !== cidadeId) throw new Error("Esse apelido já aponta para outra cidade.");
  if (!atual) await db.cidadeApelido.create({ data: { apelido, cidadeId } });
}

export async function salvarVizinhanca(cidadeId: number, vizinhasIds: number[]) {
  if (!inteiroPositivo(cidadeId) || !(await db.cidade.findUnique({ where: { id: cidadeId } }))) {
    throw new Error("Cidade inválida (não existe).");
  }
  const candidatas = [...new Set(vizinhasIds.filter((id) => inteiroPositivo(id) && id !== cidadeId))];
  const validas = (await db.cidade.findMany({ where: { id: { in: candidatas } }, select: { id: true } })).map((c) => c.id);
  await db.$transaction([
    db.cidadeVizinha.deleteMany({ where: { OR: [{ cidadeId }, { vizinhaId: cidadeId }] } }),
    db.cidadeVizinha.createMany({
      data: validas.flatMap((v) => [
        { cidadeId, vizinhaId: v },
        { cidadeId: v, vizinhaId: cidadeId },
      ]),
    }),
  ]);
}

// cidade que não está na lista (outro estado, por exemplo): cria a cidade canônica e o apelido da grafia
export async function criarCidadeDeGrafia(texto: string): Promise<number> {
  const nome = String(texto ?? "").trim();
  const apelido = normalizarCidade(nome);
  if (!apelido) throw new Error("Texto vazio.");
  if ((await db.cidade.findUnique({ where: { nome } })) || (await db.cidadeApelido.findUnique({ where: { apelido } }))) {
    throw new Error("Essa cidade já existe: associe a grafia a ela.");
  }
  const c = await db.cidade.create({ data: { nome, apelidos: { create: { apelido } } } });
  return c.id;
}

export async function removerApelidoCidade(apelidoId: number) {
  if (!inteiroPositivo(apelidoId) || !(await db.cidadeApelido.findUnique({ where: { id: apelidoId } }))) {
    throw new Error("Apelido inválido (não existe).");
  }
  await db.cidadeApelido.delete({ where: { id: apelidoId } });
}
