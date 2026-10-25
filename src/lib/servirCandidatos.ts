import type { PrismaClient } from "@prisma/client";
import { cpfReal, soDigitos } from "./cpf";
import { checarConflitoServo } from "./conflitoServo";
import { validarELiberarCodigo } from "./liberacaoConflito";
import type { DadosFixos, RespostaSalva } from "./servirRespostas";

function formatarCpf(d: string): string {
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function violouUnicidade(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && (erro as { code?: string }).code === "P2002";
}

class JaAprovado extends Error {}

function chaveNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// grava a candidatura; reenvio com o mesmo CPF na mesma missão atualiza (nunca duplica).
// APROVADO continua APROVADO e mantém servoId.
export async function registrarCandidato(
  db: PrismaClient,
  e: { missaoId: number; fixos: DadosFixos; respostas: RespostaSalva[] }
): Promise<{ novo: boolean }> {
  const { fixos: f } = e;
  const dados = {
    nome: f.nome,
    celular: f.celular,
    casado: f.casado,
    conjugeNome: f.conjugeNome,
    conjugeCelular: f.conjugeCelular,
    respostas: JSON.stringify(e.respostas),
    disponivel: f.disponivel,
  };
  const chave = { missaoId_cpf: { missaoId: e.missaoId, cpf: f.cpf } };
  const atualizar = async () => {
    const existente = await db.candidato.findUniqueOrThrow({ where: chave });
    await db.candidato.update({
      where: chave,
      data: { ...dados, status: existente.status === "APROVADO" ? "APROVADO" : "PENDENTE" },
    });
    return { novo: false };
  };
  if (await db.candidato.findUnique({ where: chave })) return atualizar();
  try {
    await db.candidato.create({ data: { missaoId: e.missaoId, cpf: f.cpf, ...dados } });
    return { novo: true };
  } catch (erro) {
    if (!violouUnicidade(erro)) throw erro;
    // dois envios simultâneos: o outro criou primeiro
    return atualizar();
  }
}

export type PessoaParecida = {
  id: number;
  nome: string;
  celular: string | null;
  motivo: "cpf" | "nome" | "celular";
  setorNaMissao: string | null; // setor, se já é servo da missão informada
};

export async function pessoasParecidas(
  db: PrismaClient,
  c: { cpf: string; nome: string; celular: string },
  missaoId?: number
): Promise<PessoaParecida[]> {
  const pessoas = await db.pessoa.findMany({ select: { id: true, nome: true, cpf: true, celular: true } });
  const cpf = soDigitos(c.cpf);
  const nome = chaveNome(c.nome);
  const celular = soDigitos(c.celular);
  const achadas: PessoaParecida[] = [];
  for (const p of pessoas) {
    let motivo: PessoaParecida["motivo"] | null = null;
    if (cpfReal(p.cpf) && soDigitos(p.cpf!) === cpf) motivo = "cpf";
    else if (chaveNome(p.nome) === nome) motivo = "nome";
    else if (celular && p.celular && soDigitos(p.celular) === celular) motivo = "celular";
    if (motivo) achadas.push({ id: p.id, nome: p.nome, celular: p.celular, motivo, setorNaMissao: null });
  }
  const ordem = { cpf: 0, nome: 1, celular: 2 } as const;
  const finais = achadas.sort((a, b) => ordem[a.motivo] - ordem[b.motivo]).slice(0, 8);
  if (missaoId !== undefined && finais.length) {
    const servos = await db.servo.findMany({
      where: { missaoId, pessoaId: { in: finais.map((p) => p.id) } },
      select: { pessoaId: true, setor: true },
    });
    const setorDe = new Map(servos.map((x) => [x.pessoaId, x.setor]));
    for (const p of finais) p.setorNaMissao = setorDe.get(p.id) ?? null;
  }
  return finais;
}

export async function historicoDaPessoa(db: PrismaClient, pessoaId: number) {
  const servos = await db.servo.findMany({
    where: { pessoaId },
    include: { missao: { select: { nome: true } } },
    orderBy: { missaoId: "desc" },
  });
  return servos.map((s) => ({ missao: s.missao.nome, setor: s.setor, status: s.status }));
}

export type ResultadoAprovar =
  | { ok: true; servoId: number }
  | { ok: false; erro: string }
  | { ok: false; conflito: { missaoConflitoNome: string; distancia: number } };

export async function aprovarCandidato(
  db: PrismaClient,
  candidatoId: number,
  o: { setor: string; pessoaId: number | null; codigoLiberacao: string | null }
): Promise<ResultadoAprovar> {
  const c = await db.candidato.findUnique({ where: { id: candidatoId } });
  if (!c) return { ok: false, erro: "Candidato não encontrado." };
  if (c.status === "APROVADO") return { ok: false, erro: "Já foi aprovado." };
  if (!c.disponivel) return { ok: false, erro: "Candidato indisponível." };
  const setor = o.setor.trim();
  if (!setor) return { ok: false, erro: "Escolha o setor." };

  let pessoaId = o.pessoaId;
  if (pessoaId !== null) {
    const pessoa = await db.pessoa.findUnique({ where: { id: pessoaId } });
    if (!pessoa) return { ok: false, erro: "Pessoa não encontrada." };
    const jaServo = await db.servo.findUnique({ where: { missaoId_pessoaId: { missaoId: c.missaoId, pessoaId } } });
    if (jaServo) return { ok: false, erro: `Já está no quadrante desta missão (setor ${jaServo.setor}).` };

    const conflito = await checarConflitoServo(pessoaId, c.missaoId);
    if (conflito && !(await validarELiberarCodigo(db, pessoaId, c.missaoId, o.codigoLiberacao))) {
      if (o.codigoLiberacao) return { ok: false, erro: "Código de liberação inválido ou expirado." };
      return { ok: false, conflito: { missaoConflitoNome: conflito.missaoConflitoNome, distancia: conflito.distancia } };
    }
    // só preenche o que está vazio no cadastro existente
    await db.pessoa.update({
      where: { id: pessoaId },
      data: {
        ...(pessoa.celular ? {} : { celular: c.celular }),
        ...(cpfReal(pessoa.cpf) || !cpfReal(c.cpf) ? {} : { cpf: formatarCpf(c.cpf) }),
      },
    });
  }

  try {
    const servoId = await db.$transaction(async (tx) => {
      // reserva a aprovação de forma atômica: de duas chamadas simultâneas, só uma passa
      const reservou = await tx.candidato.updateMany({
        where: { id: c.id, status: { not: "APROVADO" } },
        data: { status: "APROVADO" },
      });
      if (reservou.count === 0) throw new JaAprovado();
      if (pessoaId === null) {
        pessoaId = (
          await tx.pessoa.create({
            data: { nome: c.nome, celular: c.celular, cpf: cpfReal(c.cpf) ? formatarCpf(c.cpf) : null },
          })
        ).id;
      }
      const servo = await tx.servo.create({
        data: { missaoId: c.missaoId, pessoaId, setor, funcao: "INTEGRANTE", status: "ATIVO", confirmado: false },
      });
      await tx.candidato.update({ where: { id: c.id }, data: { servoId: servo.id } });
      return servo.id;
    });
    return { ok: true, servoId };
  } catch (erro) {
    if (erro instanceof JaAprovado) return { ok: false, erro: "Já foi aprovado." };
    if (violouUnicidade(erro)) return { ok: false, erro: "Já está no quadrante desta missão." };
    throw erro;
  }
}

export async function definirStatusCandidato(
  db: PrismaClient,
  id: number,
  status: "RECUSADO" | "PENDENTE"
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const c = await db.candidato.findUnique({ where: { id } });
  if (!c) return { ok: false, erro: "Candidato não encontrado." };
  if (c.status === "APROVADO") return { ok: false, erro: "Candidato já aprovado: remova o servo pelo Quadrante." };
  await db.candidato.update({ where: { id }, data: { status } });
  return { ok: true };
}
