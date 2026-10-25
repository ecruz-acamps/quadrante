"use server";

import { revalidatePath } from "next/cache";
import { db } from "./db";
import { requireRole, requireUser } from "./auth";
import { podeAcessarMissao } from "./autorizacao";
import { excedeuLimite, ipDoCliente } from "./rateLimit";
import { notificarQuadrante } from "./notificacoes";
import { TIPOS_PERGUNTA, validarFixos, validarRespostas, type EntradaResposta, type TipoPergunta } from "./servirRespostas";
import {
  atualizarPergunta, criarPergunta, definirPerguntaAtiva, garantirPerguntasIniciais,
  listarPerguntasAtivas, moverPergunta,
} from "./servirPerguntasDb";
import {
  aprovarCandidato, definirStatusCandidato, historicoDaPessoa, pessoasParecidas, registrarCandidato,
} from "./servirCandidatos";

const texto = (formData: FormData, k: string) => String(formData.get(k) ?? "");

// ---------- público ----------

// formulário público /servir/[slug]; nunca devolve dados já gravados
export async function enviarCandidatura(_prev: unknown, formData: FormData) {
  const missaoId = Number(formData.get("missaoId"));
  if (!missaoId) return { error: "Missão não encontrada." };
  if (excedeuLimite(`servir:envio:${await ipDoCliente()}`, 10, 10 * 60_000)) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }
  const missao = await db.missao.findUnique({ where: { id: missaoId } });
  if (!missao) return { error: "Missão não encontrada." };
  if (!missao.servirPublicado) return { error: "Inscrições encerradas no momento." };

  await garantirPerguntasIniciais(db);
  const perguntas = await listarPerguntasAtivas(db);

  const fixos = validarFixos({
    nome: texto(formData, "nome"),
    cpf: texto(formData, "cpf"),
    celular: texto(formData, "celular"),
    casado: texto(formData, "casado"),
    conjugeNome: texto(formData, "conjugeNome"),
    conjugeCelular: texto(formData, "conjugeCelular"),
    disponivel: texto(formData, "disponivel"),
  });
  const entrada: Record<number, EntradaResposta> = {};
  for (const p of perguntas) {
    entrada[p.id] = { valores: formData.getAll(`p_${p.id}`).map(String), outra: texto(formData, `p_${p.id}_outra`) };
  }
  const respostas = validarRespostas(perguntas, entrada);

  const erros: Record<string, string> = {};
  if (!fixos.ok) Object.assign(erros, fixos.erros);
  if (!respostas.ok) for (const [id, msg] of Object.entries(respostas.erros)) erros[`p_${id}`] = msg;
  if (formData.get("lgpd") !== "on") erros.lgpd = "É preciso aceitar para enviar.";
  if (Object.keys(erros).length || !fixos.ok || !respostas.ok) return { erros };

  await registrarCandidato(db, { missaoId, fixos: fixos.dados, respostas: respostas.respostas });
  revalidatePath("/candidatos");
  return { ok: true as const };
}

// ---------- configuração (SUPER) ----------

export async function definirServirConfig(missaoId: number, publicado: boolean, datas: string) {
  await requireRole("SUPER");
  const missao = await db.missao.update({
    where: { id: missaoId },
    data: { servirPublicado: publicado, servirDatas: datas.trim().slice(0, 80) || null },
  });
  revalidatePath("/configuracoes");
  revalidatePath(`/servir/${missao.cercoSlug}`);
}

function revalidarFormulario() {
  revalidatePath("/configuracoes/perguntas-servir");
  revalidatePath("/servir/[slug]", "page");
}

export async function salvarPerguntaServir(_prev: unknown, formData: FormData) {
  await requireRole("SUPER");
  const tipo = texto(formData, "tipo") as TipoPergunta;
  if (!TIPOS_PERGUNTA.includes(tipo)) return { error: "Tipo de pergunta inválido." };
  const dados = {
    titulo: texto(formData, "titulo"),
    tipo,
    obrigatoria: formData.get("obrigatoria") === "on",
    opcoes: texto(formData, "opcoes").split("\n"),
    permiteOutra: formData.get("permiteOutra") === "on",
  };
  const id = Number(formData.get("id"));
  const r = id ? await atualizarPergunta(db, id, dados) : await criarPergunta(db, dados);
  if (!r.ok) return { error: r.erro };
  revalidarFormulario();
  return { ok: true as const };
}

export async function moverPerguntaServir(id: number, direcao: "cima" | "baixo") {
  await requireRole("SUPER");
  await moverPergunta(db, id, direcao);
  revalidarFormulario();
}

export async function ativarPerguntaServir(id: number, ativa: boolean) {
  await requireRole("SUPER");
  await definirPerguntaAtiva(db, id, ativa);
  revalidarFormulario();
}

// ---------- triagem (admin com acesso à missão) ----------

async function candidatoAcessivel(candidatoId: number) {
  const usuario = await requireUser();
  const c = await db.candidato.findUnique({ where: { id: candidatoId } });
  if (!c || !(await podeAcessarMissao(usuario, c.missaoId))) return null;
  return { usuario, candidato: c };
}

// pessoas já cadastradas que parecem ser o candidato, com o histórico de cada uma (painel "Aprovar")
export async function parecidasDoCandidatoServir(candidatoId: number) {
  const acesso = await candidatoAcessivel(candidatoId);
  if (!acesso) return [];
  const c = acesso.candidato;
  const parecidas = await pessoasParecidas(db, { cpf: c.cpf, nome: c.nome, celular: c.celular }, c.missaoId);
  return Promise.all(parecidas.map(async (p) => ({ ...p, historico: await historicoDaPessoa(db, p.id) })));
}

export async function aprovarCandidatoServir(_prev: unknown, formData: FormData) {
  const acesso = await candidatoAcessivel(Number(formData.get("candidatoId")));
  if (!acesso) return { erro: "Sem acesso a esta missão." };
  const pessoaIdRaw = texto(formData, "pessoaId");
  const r = await aprovarCandidato(db, acesso.candidato.id, {
    setor: texto(formData, "setor"),
    pessoaId: pessoaIdRaw ? Number(pessoaIdRaw) : null,
    codigoLiberacao: texto(formData, "codigoLiberacao").trim() || null,
  });
  if (r.ok) {
    await notificarQuadrante("adicionado", {
      nome: acesso.candidato.nome,
      setor: texto(formData, "setor"),
      missaoId: acesso.candidato.missaoId,
      autor: acesso.usuario.nome,
    });
    revalidatePath("/candidatos");
    revalidatePath("/servos");
  }
  return r;
}

export async function recusarCandidatoServir(candidatoId: number) {
  const acesso = await candidatoAcessivel(candidatoId);
  if (!acesso) return { ok: false as const, erro: "Sem acesso a esta missão." };
  const r = await definirStatusCandidato(db, candidatoId, "RECUSADO");
  revalidatePath("/candidatos");
  return r;
}

export async function reabrirCandidatoServir(candidatoId: number) {
  const acesso = await candidatoAcessivel(candidatoId);
  if (!acesso) return { ok: false as const, erro: "Sem acesso a esta missão." };
  const r = await definirStatusCandidato(db, candidatoId, "PENDENTE");
  revalidatePath("/candidatos");
  return r;
}
