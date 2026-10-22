"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { createSession, destroySession, requireUser, requireRole, requireCoordenador, setMissaoAtiva } from "./auth";
import { statusValido, podeMarcarServo, dadosDoStatus, normalizarRole, camisetaValida } from "./coordenador";
import { podeAcessarMissao, acessoRegistros, exigirMissao, exigirRegistros } from "./autorizacao";
import { normalizarNome } from "./nomes";
import { FUNCOES, PAGAMENTOS, HORARIOS_CERCO, CAMISETAS } from "./constants";
import { reservarHorarioCerco } from "./cercoReserva";
import { edicaoDe } from "./missoes";
import { gerarCodigo6Digitos, checarConflitoServo } from "./conflitoServo";
import { notificarPushbird, notificarQuadrante } from "./notificacoes";
import { excedeuLimite, limparLimite, ipDoCliente } from "./rateLimit";

// ---------- auth ----------
export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const ip = await ipDoCliente();
  const chaveEmail = `login:email:${email}`;
  // 10 tentativas por IP e 5 por e-mail em 15 min (conta tentativas inválidas e válidas do IP)
  if (excedeuLimite(`login:ip:${ip}`, 10, 15 * 60_000) || excedeuLimite(chaveEmail, 5, 15 * 60_000)) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }
  const user = await db.usuario.findUnique({ where: { email } });
  // compara sempre, mesmo sem usuário, para não revelar por tempo se o e-mail existe
  const hash = user?.senha ?? "$2b$10$HLmxZfgpcFuZXdo9rkLjc.S/5r7AwOPAK64lwUPs4tfnqK95a0gji";
  const ok = await bcrypt.compare(senha, hash);
  if (!user || !user.senha || !ok) {
    return { error: "E-mail ou senha inválidos" };
  }
  limparLimite(chaveEmail);
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ---------- missões ----------
// campos usados nas fichas: data YYYY-MM-DD válida ou null; texto livre aparado ou null
function dataIsoDe(raw: FormDataEntryValue | null): string | null {
  const v = String(raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function textoOuNull(raw: FormDataEntryValue | null): string | null {
  return String(raw ?? "").trim().slice(0, 120) || null;
}

// vagas por hora do Cerco: inteiro de 1 a 200; vazio/inválido cai no padrão (15)
function vagasCercoDe(raw: FormDataEntryValue | null): number | null {
  if (raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
}

export async function criarMissao(formData: FormData) {
  await requireRole("SUPER");
  const mesRaw = formData.get("mes");
  const anoCalendarioRaw = formData.get("anoCalendario");
  const m = await db.missao.create({
    data: {
      nome: String(formData.get("nome")),
      tipo: String(formData.get("tipo")),
      ano: Number(formData.get("ano")),
      mes: mesRaw ? Number(mesRaw) : null,
      anoCalendario: anoCalendarioRaw ? Number(anoCalendarioRaw) : null,
      dataInicio: dataIsoDe(formData.get("dataInicio")),
      dataFim: dataIsoDe(formData.get("dataFim")),
      pixChave: textoOuNull(formData.get("pixChave")),
      contatoFinanceiro: textoOuNull(formData.get("contatoFinanceiro")),
      cercoSlug: String(formData.get("cercoSlug")).toLowerCase().replace(/[^a-z0-9-]/g, ""),
      valorInterna: Number(formData.get("valorInterna") || 160),
      valorExterna: Number(formData.get("valorExterna") || 80),
      valorCampista: Number(formData.get("valorCampista") || 300),
      cercoMaxPorHorario: vagasCercoDe(formData.get("cercoMaxPorHorario")) ?? 15,
    },
  });
  await setMissaoAtiva(m.id);
  revalidatePath("/");
}

export async function atualizarMissao(
  _prevState: unknown,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  await requireRole("SUPER");
  const id = Number(formData.get("id"));
  const mesRaw = formData.get("mes");
  const anoCalendarioRaw = formData.get("anoCalendario");
  const vagasRaw = formData.get("cercoMaxPorHorario");
  const vagas = vagasCercoDe(vagasRaw);
  if (vagas === null && vagasRaw !== null && String(vagasRaw).trim() !== "") {
    return { error: "As vagas por hora do Cerco devem ser um número inteiro de 1 a 200." };
  }
  await db.missao.update({
    where: { id },
    data: {
      nome: String(formData.get("nome")),
      tipo: String(formData.get("tipo")),
      ano: Number(formData.get("ano")),
      mes: mesRaw ? Number(mesRaw) : null,
      anoCalendario: anoCalendarioRaw ? Number(anoCalendarioRaw) : null,
      dataInicio: dataIsoDe(formData.get("dataInicio")),
      dataFim: dataIsoDe(formData.get("dataFim")),
      pixChave: textoOuNull(formData.get("pixChave")),
      contatoFinanceiro: textoOuNull(formData.get("contatoFinanceiro")),
      cercoSlug: String(formData.get("cercoSlug")).toLowerCase().replace(/[^a-z0-9-]/g, ""),
      valorInterna: Number(formData.get("valorInterna") || 160),
      valorExterna: Number(formData.get("valorExterna") || 80),
      valorCampista: Number(formData.get("valorCampista") || 300),
      ...(vagas !== null ? { cercoMaxPorHorario: vagas } : {}),
    },
  });
  revalidatePath("/missoes");
  revalidatePath(`/cerco/${String(formData.get("cercoSlug")).toLowerCase().replace(/[^a-z0-9-]/g, "")}`);
  return { ok: true } as const;
}

export async function excluirMissao(formData: FormData) {
  await requireRole("SUPER");
  const id = Number(formData.get("id"));
  if (!id) return;

  await db.$transaction([
    db.fichaAlerta.deleteMany({
      where: { OR: [{ origem: { missaoId: id } }, { alvo: { missaoId: id } }] },
    }),
    db.triboLider.deleteMany({ where: { tribo: { missaoId: id } } }),
    db.neocampista.deleteMany({ where: { missaoId: id } }),
    db.tribo.deleteMany({ where: { missaoId: id } }),
    db.servo.deleteMany({ where: { missaoId: id } }),
    db.liberacaoConflitoServo.deleteMany({ where: { missaoId: id } }),
    db.missao.delete({ where: { id } }),
  ]);

  revalidatePath("/missoes");
}

export async function selecionarMissao(formData: FormData) {
  await requireUser();
  await setMissaoAtiva(Number(formData.get("id")));
  revalidatePath("/");
}

// ---------- servos ----------
function servoData(formData: FormData) {
  const s = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : String(v);
  };
  return {
    setor: String(formData.get("setor")),
    funcao: String(formData.get("funcao") || "INTEGRANTE"),
    camiseta: s("camiseta"),
    status: String(formData.get("status") || "ATIVO"),
    formacao1: s("formacao1"),
    formacao2: s("formacao2"),
    formacao3: s("formacao3"),
    motivoFalta: s("motivoFalta"),
    pagamentoForma: s("pagamentoForma"),
    pagamentoValor: formData.get("pagamentoValor") ? Number(formData.get("pagamentoValor")) : null,
    pago: formData.get("pago") === "on",
    observacoes: s("observacoes"),
    cercoHorario: s("cercoHorario"),
  };
}

// sequência de missões mais recentes seguidas no mesmo setor (nunca ordenar por `ano`, usar edicaoDe)
async function calcularSetorConsecutivo(pessoaId: number): Promise<{ setor: string; vezes: number } | null> {
  const registros = await db.servo.findMany({ where: { pessoaId }, include: { missao: true } });
  if (!registros.length) return null;
  const ordenados = [...registros].sort((a, b) => edicaoDe(b.missao.nome) - edicaoDe(a.missao.nome));
  const setor = ordenados[0].setor;
  let vezes = 0;
  for (const r of ordenados) {
    if (r.setor === setor) vezes++;
    else break;
  }
  return { setor, vezes };
}

export async function buscarPessoas(missaoId: number, nome: string) {
  const usuario = await requireUser();
  if (!(await podeAcessarMissao(usuario, missaoId))) return [];
  const termo = nome.trim();
  if (termo.length < 2) return [];

  const pessoas = await db.pessoa.findMany({
    where: { nome: { contains: termo }, servos: { none: { missaoId } } },
    take: 8,
    orderBy: { nome: "asc" },
  });

  return Promise.all(
    pessoas.map(async (p) => {
      const ultimoServo = await db.servo.findFirst({
        where: { pessoaId: p.id },
        orderBy: { missaoId: "desc" },
      });
      const repeticoesNoSetor = ultimoServo
        ? await db.servo.count({ where: { pessoaId: p.id, setor: ultimoServo.setor } })
        : 0;
      const setorConsecutivo = await calcularSetorConsecutivo(p.id);
      return {
        id: p.id,
        nome: p.nome,
        cpf: p.cpf,
        celular: p.celular,
        endereco: p.endereco,
        bairro: p.bairro,
        cidade: p.cidade,
        paroquia: p.paroquia,
        setor: ultimoServo?.setor ?? null,
        funcao: ultimoServo?.funcao ?? null,
        camiseta: ultimoServo?.camiseta ?? null,
        repeticoesNoSetor,
        setorConsecutivo,
      };
    })
  );
}

// missão (e tribo) em que cada nome foi neocampista; vale a edição mais recente
async function neocampistaPorNome(nomes: string[]) {
  const fichas = await db.neocampista.findMany({
    where: { nome: { in: nomes } },
    select: { nome: true, missao: { select: { id: true, nome: true } }, tribo: { select: { nome: true } } },
  });
  const mapa = new Map<string, { missao: string; tribo: string | null; edicao: number }>();
  for (const f of fichas) {
    const chave = f.nome.trim().toLowerCase();
    const edicao = edicaoDe(f.missao.nome);
    const atual = mapa.get(chave);
    if (!atual || edicao > atual.edicao) mapa.set(chave, { missao: f.missao.nome, tribo: f.tribo?.nome ?? null, edicao });
  }
  return (nome: string) => {
    const r = mapa.get(nome.trim().toLowerCase());
    return r ? { missao: r.missao, tribo: r.tribo } : null;
  };
}

// busca global (pessoas + neocampistas de qualquer missão) para o modal "Adicionar servo" por setor
export async function buscarPessoasGlobal(missaoId: number, termo: string) {
  const usuario = await requireUser();
  if (!(await podeAcessarMissao(usuario, missaoId))) return [];
  const t = termo.trim();
  if (t.length < 2) return [];

  const pessoas = await db.pessoa.findMany({
    where: { nome: { contains: t } },
    take: 10,
  });
  const contagens = await db.servo.groupBy({
    by: ["pessoaId"],
    where: { pessoaId: { in: pessoas.map((p) => p.id) } },
    _count: true,
  });
  const missoesPorPessoa = new Map(contagens.map((c) => [c.pessoaId, c._count]));
  const servosNaMissao = await db.servo.findMany({
    where: { missaoId, pessoaId: { in: pessoas.map((p) => p.id) } },
    select: { pessoaId: true, status: true },
  });
  const statusNaMissao = new Map(servosNaMissao.map((s) => [s.pessoaId, s.status]));

  const campistaDe = await neocampistaPorNome(pessoas.map((p) => p.nome));
  const resultadoPessoas = await Promise.all(
    pessoas.map(async (p) => ({
      origem: "pessoa" as const,
      id: p.id,
      nome: p.nome,
      cidade: p.cidade,
      missoes: missoesPorPessoa.get(p.id) ?? 0,
      jaEhServoNaMissao: statusNaMissao.has(p.id),
      statusNaMissao: statusNaMissao.get(p.id) ?? null,
      neocampista: campistaDe(p.nome),
      setorConsecutivo: await calcularSetorConsecutivo(p.id),
    }))
  );

  // campistas de qualquer missão cujo nome ainda não existe como Pessoa
  const nomesPessoa = new Set(
    (await db.pessoa.findMany({ select: { nome: true } })).map((p) => p.nome.trim().toLowerCase())
  );
  const campistas = await db.neocampista.findMany({
    where: { nome: { contains: t } },
    take: 20,
    orderBy: { id: "desc" },
    include: { missao: { select: { nome: true } }, tribo: { select: { nome: true } } },
  });
  const vistos = new Set<string>();
  const resultadoCampistas: Array<Omit<(typeof resultadoPessoas)[number], "origem"> & { origem: "campista" }> = [];
  for (const c of campistas) {
    const chave = c.nome.trim().toLowerCase();
    if (nomesPessoa.has(chave) || vistos.has(chave)) continue;
    vistos.add(chave);
    resultadoCampistas.push({
      origem: "campista" as const,
      id: c.id,
      nome: c.nome,
      cidade: c.cidade,
      missoes: 0,
      jaEhServoNaMissao: false,
      statusNaMissao: null,
      neocampista: {
        missao: c.missao.nome,
        tribo: c.tribo?.nome ?? null,
      },
      setorConsecutivo: null,
    });
  }

  return [...resultadoPessoas, ...resultadoCampistas]
    .sort((a, b) => b.missoes - a.missoes)
    .slice(0, 10);
}

// adiciona servo a partir do modal do card de setor (sem redigitar dados de quem já existe)
export async function adicionarServoRapido(formData: FormData) {
  const usuario = await requireUser();
  const missaoId = Number(formData.get("missaoId"));
  if (!(await podeAcessarMissao(usuario, missaoId))) {
    return { error: "Sem acesso a esta missão." };
  }
  const setor = String(formData.get("setor") || "");
  const pessoaIdRaw = formData.get("pessoaId");
  const neocampistaIdRaw = formData.get("neocampistaId");
  const nomeNovo = String(formData.get("nomeNovo") || "").trim();

  let pessoaId: number;

  if (pessoaIdRaw) {
    pessoaId = Number(pessoaIdRaw);
    const jaExiste = await db.servo.findUnique({
      where: { missaoId_pessoaId: { missaoId, pessoaId } },
    });
    if (jaExiste) {
      return { error: `Já está no quadrante desta missão (setor ${jaExiste.setor}).` };
    }
  } else if (neocampistaIdRaw) {
    const ficha = await db.neocampista.findUniqueOrThrow({ where: { id: Number(neocampistaIdRaw) } });
    const nomeNormalizado = normalizarNome(ficha.nome);
    let pessoa = await db.pessoa.findFirst({
      where: { nome: { equals: nomeNormalizado } },
    });
    if (!pessoa) {
      pessoa = await db.pessoa.create({
        data: {
          nome: nomeNormalizado,
          endereco: ficha.endereco,
          bairro: ficha.bairro,
          cidade: ficha.cidade,
          celular: ficha.celular,
          sexo: ficha.sexo,
          camiseta: ficha.camiseta,
          cpf: ficha.cpf,
        },
      });
    }
    pessoaId = pessoa.id;
    const jaExiste = await db.servo.findUnique({
      where: { missaoId_pessoaId: { missaoId, pessoaId } },
    });
    if (jaExiste) {
      return { error: `Já está no quadrante desta missão (setor ${jaExiste.setor}).` };
    }
  } else if (nomeNovo) {
    const pessoa = await db.pessoa.create({ data: { nome: normalizarNome(nomeNovo) } });
    pessoaId = pessoa.id;
  } else {
    return { error: "Selecione uma pessoa ou digite um nome." };
  }

  const conflito = await checarConflitoServo(pessoaId, missaoId);
  if (conflito) {
    const codigo = String(formData.get("codigoLiberacao") || "") || null;
    const liberado = await validarELiberarCodigo(pessoaId, missaoId, codigo);
    if (!liberado) {
      if (codigo) return { error: "Código de liberação inválido ou expirado." };
      return {
        conflito: {
          pessoaId,
          missaoId,
          missaoConflitoNome: conflito.missaoConflitoNome,
          distancia: conflito.distancia,
        },
      };
    }
  }

  await db.servo.create({
    data: { missaoId, pessoaId, setor, funcao: "INTEGRANTE", status: "ATIVO" },
  });
  const pessoaAdd = await db.pessoa.findUnique({ where: { id: pessoaId }, select: { nome: true } });
  await notificarQuadrante("adicionado", { nome: pessoaAdd?.nome ?? "—", setor, missaoId, autor: usuario.nome });
  revalidatePath("/servos");
  return { ok: true };
}

// missões SENIOR que têm neocampistas cadastrados — para escolher de onde puxar a Evangelização
export async function listarMissoesComNeocampistas() {
  await requireUser();
  const missoes = await db.missao.findMany({
    where: { neocampistas: { some: { situacao: "OK" } } },
    orderBy: { id: "desc" },
    include: { _count: { select: { neocampistas: true } } },
  });
  return missoes.map((m) => ({
    id: m.id,
    nome: m.nome,
    ano: m.ano,
    tipo: m.tipo,
    totalNeocampistas: m._count.neocampistas,
  }));
}

// puxa todos os neocampistas (situação OK) de uma missão de origem e os adiciona
// como servos no setor Evangelização da missão de destino (a ativa no momento)
export async function chamarEvangelizacao(missaoOrigemId: number, missaoDestinoId: number) {
  const usuario = await requireUser();
  // a origem é só leitura (campistas de edições anteriores viram servos); o acesso exigido é ao destino, onde se grava
  await exigirMissao(usuario, missaoDestinoId);
  const fichas = await db.neocampista.findMany({ where: { missaoId: missaoOrigemId, situacao: "OK" } });

  let adicionados = 0;
  let jaEstavam = 0;
  let comConflito = 0;

  for (const ficha of fichas) {
    const nomeNormalizado = normalizarNome(ficha.nome);
    let pessoa = await db.pessoa.findFirst({ where: { nome: { equals: nomeNormalizado } } });
    if (!pessoa) {
      pessoa = await db.pessoa.create({
        data: {
          nome: nomeNormalizado,
          endereco: ficha.endereco,
          bairro: ficha.bairro,
          cidade: ficha.cidade,
          celular: ficha.celular,
          sexo: ficha.sexo,
          camiseta: ficha.camiseta,
          cpf: ficha.cpf,
        },
      });
    }

    const jaExiste = await db.servo.findUnique({
      where: { missaoId_pessoaId: { missaoId: missaoDestinoId, pessoaId: pessoa.id } },
    });
    if (jaExiste) {
      jaEstavam++;
      continue;
    }

    const conflito = await checarConflitoServo(pessoa.id, missaoDestinoId);
    if (conflito) {
      comConflito++;
      continue;
    }

    await db.servo.create({
      data: { missaoId: missaoDestinoId, pessoaId: pessoa.id, setor: "EVANGELIZAÇÃO", funcao: "INTEGRANTE", status: "ATIVO" },
    });
    adicionados++;
  }

  revalidatePath("/servos");
  return { adicionados, jaEstavam, comConflito, total: fichas.length };
}

// valida um código de liberação de conflito; se válido, marca como usado e retorna true.
async function validarELiberarCodigo(pessoaId: number, missaoId: number, codigo: string | null) {
  if (!codigo) return false;
  const resultado = await db.liberacaoConflitoServo.updateMany({
    where: { pessoaId, missaoId, codigo, usado: false, expiraEm: { gt: new Date() } },
    data: { usado: true },
  });
  return resultado.count === 1;
}

export async function criarServo(_prevState: unknown, formData: FormData) {
  const usuario = await requireUser();
  const missaoId = Number(formData.get("missaoId"));
  if (!(await podeAcessarMissao(usuario, missaoId))) return { error: "Sem acesso a esta missão." };
  const status = String(formData.get("status") || "ATIVO");
  const s = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : String(v);
  };
  const nome = normalizarNome(String(formData.get("nome")));

  if (status === "ATIVO") {
    const candidatos = await db.pessoa.findMany({ where: { nome } });
    let conflitoEncontrado: { pessoaId: number; conflito: NonNullable<Awaited<ReturnType<typeof checarConflitoServo>>> } | null = null;
    for (const candidato of candidatos) {
      const conflito = await checarConflitoServo(candidato.id, missaoId);
      if (conflito) {
        conflitoEncontrado = { pessoaId: candidato.id, conflito };
        break;
      }
    }
    if (conflitoEncontrado) {
      const { pessoaId: pessoaConflitoId, conflito } = conflitoEncontrado;
      const codigo = s("codigoLiberacao");
      const liberado = await validarELiberarCodigo(pessoaConflitoId, missaoId, codigo);
      if (!liberado) {
        if (codigo) return { error: "Código de liberação inválido ou expirado." };
        return {
          conflito: {
            pessoaId: pessoaConflitoId,
            missaoId,
            missaoConflitoNome: conflito.missaoConflitoNome,
            distancia: conflito.distancia,
          },
        };
      }
    }
  }

  const pessoa = await db.pessoa.create({
    data: {
      nome,
      cpf: s("cpf"),
      celular: s("celular"),
      endereco: s("endereco"),
      bairro: s("bairro"),
      cidade: s("cidade"),
      paroquia: s("paroquia"),
      sexo: s("sexo"),
      camiseta: s("camiseta"),
    },
  });
  const servoCriado = await db.servo.create({ data: { missaoId, pessoaId: pessoa.id, ...servoData(formData) } });
  if (servoCriado.status === "ATIVO") {
    await notificarQuadrante("adicionado", { nome: pessoa.nome, setor: servoCriado.setor, missaoId, autor: usuario.nome });
  }
  revalidatePath("/servos");
  return { ok: true } as const;
}

export async function atualizarServo(_prevState: unknown, formData: FormData) {
  const usuario = await requireUser();
  const id = Number(formData.get("id"));
  if (!(await acessoRegistros(usuario, ["servo", id]))) return { error: "Sem acesso a este servo." };
  const servo = await db.servo.findUniqueOrThrow({ where: { id } });
  const status = String(formData.get("status") || "ATIVO");
  const s = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : String(v);
  };

  if (status === "ATIVO" && servo.status !== "ATIVO") {
    const conflito = await checarConflitoServo(servo.pessoaId, servo.missaoId);
    if (conflito) {
      const codigo = s("codigoLiberacao");
      const liberado = await validarELiberarCodigo(servo.pessoaId, servo.missaoId, codigo);
      if (!liberado) {
        if (codigo) return { error: "Código de liberação inválido ou expirado." };
        return {
          conflito: {
            pessoaId: servo.pessoaId,
            missaoId: servo.missaoId,
            missaoConflitoNome: conflito.missaoConflitoNome,
            distancia: conflito.distancia,
          },
        };
      }
    }
  }

  await db.pessoa.update({
    where: { id: servo.pessoaId },
    data: {
      nome: normalizarNome(String(formData.get("nome"))),
      cpf: s("cpf"),
      celular: s("celular"),
      endereco: s("endereco"),
      bairro: s("bairro"),
      cidade: s("cidade"),
      paroquia: s("paroquia"),
    },
  });
  await db.servo.update({ where: { id }, data: servoData(formData) });
  revalidatePath("/servos");
  redirect("/servos");
}

export async function atualizarServoInline(
  servoId: number,
  dados: { camiseta?: string | null; pago?: boolean; funcao?: string; cercoHorario?: string | null; pagamentoForma?: string | null }
) {
  const usuario = await requireUser();
  if (!(await acessoRegistros(usuario, ["servo", servoId]))) return { error: "Sem acesso a este servo." } as const;
  const { camiseta, pago, funcao, cercoHorario, pagamentoForma } = dados;
  if (funcao !== undefined && !FUNCOES.includes(funcao)) return { error: "Função inválida." } as const;
  if (pagamentoForma && !PAGAMENTOS.includes(pagamentoForma)) return { error: "Forma de pagamento inválida." } as const;
  await db.servo.update({ where: { id: servoId }, data: { camiseta, pago, funcao, cercoHorario, pagamentoForma } });
  revalidatePath("/servos");
  revalidatePath("/formacao");
  return { ok: true } as const;
}

// move o servo para outro setor mantendo o resto; coordenador só continua coordenador se o destino não tiver um
export async function moverServo(servoId: number, novoSetor: string) {
  const usuario = await requireUser();
  if (!(await acessoRegistros(usuario, ["servo", servoId]))) return { error: "Sem acesso a este servo." } as const;
  const servo = await db.servo.findUnique({ where: { id: servoId }, include: { pessoa: { select: { nome: true } } } });
  if (!servo) return { error: "Servo não encontrado." } as const;
  if (servo.setor === novoSetor) return { error: "O servo já está neste setor." } as const;
  if (!(await db.setor.findUnique({ where: { nome: novoSetor } }))) return { error: "Setor inválido." } as const;
  let funcao = servo.funcao;
  if (funcao === "COORDENADOR") {
    const jaTem = await db.servo.count({
      where: { missaoId: servo.missaoId, setor: novoSetor, funcao: "COORDENADOR", status: "ATIVO" },
    });
    if (jaTem > 0) funcao = "INTEGRANTE";
  }
  await db.servo.update({ where: { id: servoId }, data: { setor: novoSetor, funcao } });
  await notificarQuadrante("movido", {
    nome: servo.pessoa.nome,
    setor: novoSetor,
    setorOrigem: servo.setor,
    missaoId: servo.missaoId,
    autor: usuario.nome,
  });
  revalidatePath("/servos");
  return { ok: true, funcaoAlterada: funcao !== servo.funcao } as const;
}

export async function excluirServo(formData: FormData) {
  const usuario = await requireUser();
  const id = Number(formData.get("id"));
  await exigirRegistros(usuario, ["servo", id]);
  const servo = await db.servo.findUnique({ where: { id }, include: { pessoa: { select: { nome: true } } } });
  await db.servo.delete({ where: { id } });
  if (servo) {
    await notificarQuadrante("excluido", { nome: servo.pessoa.nome, setor: servo.setor, missaoId: servo.missaoId, autor: usuario.nome });
  }
  revalidatePath("/servos");
}

// apaga os INTEGRANTE ativos de um setor, mantendo coordenadores, auxiliares e apoio
export async function excluirIntegrantesSetor(formData: FormData) {
  const usuario = await requireUser();
  const missaoId = Number(formData.get("missaoId"));
  const setor = String(formData.get("setor") ?? "");
  await exigirMissao(usuario, missaoId);
  if (!setor) throw new Error("Setor inválido.");
  const where = { missaoId, setor, funcao: "INTEGRANTE", status: "ATIVO" }; // preserva o histórico de desistências/recusas
  const [, apagados] = await db.$transaction([
    db.triboLider.deleteMany({ where: { servo: where } }),
    db.servo.deleteMany({ where }),
  ]);
  if (apagados.count > 0) {
    await notificarQuadrante("excluido", { nome: "", setor, missaoId, autor: usuario.nome, quantidade: apagados.count });
  }
  revalidatePath("/servos");
}

// ---------- liberação de conflito de servo ----------
export async function solicitarLiberacaoConflito(pessoaId: number, missaoId: number) {
  const usuario = await requireUser();
  await exigirMissao(usuario, missaoId);
  const [pessoa, missaoDestino] = await Promise.all([
    db.pessoa.findUniqueOrThrow({ where: { id: pessoaId } }),
    db.missao.findUniqueOrThrow({ where: { id: missaoId } }),
  ]);
  const conflito = await checarConflitoServo(pessoaId, missaoId);
  const missaoOrigemNome = conflito?.missaoConflitoNome ?? "outra missão";
  const codigo = gerarCodigo6Digitos();
  await db.liberacaoConflitoServo.create({
    data: {
      pessoaId,
      missaoId,
      codigo,
      expiraEm: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  await notificarPushbird(
    "conflito",
    "Liberação de servo pendente",
    `${pessoa.nome} já é servo ativo em "${missaoOrigemNome}" e está sendo cadastrado em "${missaoDestino.nome}". Código de liberação: ${codigo} (válido por 15 min).`
  );
  return { ok: true } as const;
}

export async function marcarDesistiu(formData: FormData) {
  const usuario = await requireUser();
  const id = Number(formData.get("id"));
  await exigirRegistros(usuario, ["servo", id]);
  const motivo = String(formData.get("motivo") || "").trim();
  const servo = await db.servo.update({
    where: { id },
    data: { status: "DESISTIU", motivoDesistiu: motivo || null },
    include: { pessoa: { select: { nome: true } } },
  });
  await notificarQuadrante("desistiu", { nome: servo.pessoa.nome, setor: servo.setor, missaoId: servo.missaoId, autor: usuario.nome });
  revalidatePath("/servos");
  revalidatePath("/registros");
}

export async function marcarRecusou(formData: FormData) {
  const usuario = await requireUser();
  const id = Number(formData.get("id"));
  await exigirRegistros(usuario, ["servo", id]);
  const motivo = String(formData.get("motivo") || "").trim();
  const servo = await db.servo.update({
    where: { id },
    data: { status: "RECUSOU", motivoRecusou: motivo || null },
    include: { pessoa: { select: { nome: true } } },
  });
  await notificarQuadrante("recusou", { nome: servo.pessoa.nome, setor: servo.setor, missaoId: servo.missaoId, autor: usuario.nome });
  revalidatePath("/servos");
  revalidatePath("/registros");
}

// ---------- coordenador: marca sim / não / desistiu nos servos do próprio setor ----------
export async function marcarStatusServo(servoId: number, status: string, motivo?: string) {
  const { usuario, setor, missaoIds } = await requireCoordenador();
  if (!Number.isSafeInteger(servoId) || servoId <= 0 || servoId > 2147483647) return { error: "Servo inválido." } as const;
  if (!statusValido(status)) return { error: "Status inválido." } as const;

  const servo = await db.servo.findUnique({
    where: { id: servoId },
    select: { id: true, setor: true, missaoId: true },
  });
  if (!servo || !podeMarcarServo({ setor, missaoIds }, servo)) {
    return { error: "Servo não encontrado no seu setor." } as const;
  }

  const atualizado = await db.servo.update({
    where: { id: servo.id },
    data: dadosDoStatus(status, typeof motivo === "string" ? motivo : undefined),
    include: { pessoa: { select: { nome: true } } },
  });
  if (status === "RECUSOU" || status === "DESISTIU") {
    await notificarQuadrante(status === "RECUSOU" ? "recusou" : "desistiu", {
      nome: atualizado.pessoa.nome, setor: atualizado.setor, missaoId: atualizado.missaoId, autor: usuario.nome,
    });
  }
  revalidatePath("/meu-setor");
  revalidatePath("/servos");
  revalidatePath("/registros");
  return { ok: true } as const;
}

// coordenador altera só a camiseta dos servos do próprio setor
export async function atualizarCamisetaServo(servoId: number, camiseta: string | null) {
  const { usuario, setor, missaoIds } = await requireCoordenador();
  if (!Number.isSafeInteger(servoId) || servoId <= 0 || servoId > 2147483647) return { error: "Servo inválido." } as const;
  if (!camisetaValida(camiseta, CAMISETAS)) return { error: "Tamanho inválido." } as const;
  const servo = await db.servo.findUnique({ where: { id: servoId }, select: { id: true, setor: true, missaoId: true } });
  if (!servo || !podeMarcarServo({ setor, missaoIds }, servo)) {
    return { error: "Servo não encontrado no seu setor." } as const;
  }
  await db.servo.update({ where: { id: servo.id }, data: { camiseta } });
  revalidatePath("/meu-setor");
  revalidatePath("/servos");
  revalidatePath("/camisetas");
  return { ok: true } as const;
}

// ---------- formação (3 formações por missão) ----------
export async function marcarFormacao(formData: FormData) {
  const usuario = await requireUser();
  const servoId = Number(formData.get("servoId"));
  await exigirRegistros(usuario, ["servo", servoId]);
  const numero = Number(formData.get("numero")); // 1 | 2 | 3
  const presente = formData.get("presente") === "true";
  const motivo = String(formData.get("motivo") || "").trim();
  if (![1, 2, 3].includes(numero)) return;

  const campo = `formacao${numero}` as "formacao1" | "formacao2" | "formacao3";
  const data: Record<string, string | null> = { [campo]: presente ? "SIM" : "Não" };
  if (!presente) data.motivoFalta = motivo || null;

  await db.servo.update({ where: { id: servoId }, data });
  revalidatePath("/formacao");
  revalidatePath("/registros");
}

// ---------- cerco (público) ----------

// autocomplete público do cerco: retorna SÓ nomes (nunca horário/setor de outra pessoa)
export async function sugerirNomesCerco(missaoId: number, termo: string) {
  const t = termo.trim();
  if (t.length < 3 || !missaoId) return [];
  if (excedeuLimite(`cerco:sugestao:${await ipDoCliente()}`, 60, 60_000)) return [];
  const servos = await db.servo.findMany({
    where: { missaoId, status: "ATIVO", pessoa: { nome: { contains: t } } },
    include: { pessoa: true },
    take: 8,
    orderBy: { pessoa: { nome: "asc" } },
  });
  const nomes = [...new Set(servos.map((s) => s.pessoa.nome))];
  return nomes.slice(0, 8);
}

export async function inscreverCerco(_prev: unknown, formData: FormData) {
  const missaoId = Number(formData.get("missaoId"));
  const nome = String(formData.get("nome") || "").trim();
  const horario = String(formData.get("horario") || "").trim();
  if (!missaoId || !nome || !horario) {
    return { error: "Preencha seu nome e escolha um horário." };
  }
  if (!HORARIOS_CERCO.includes(horario)) return { error: "Horário inválido." };
  if (excedeuLimite(`cerco:inscricao:${await ipDoCliente()}`, 10, 10 * 60_000)) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  const missao = await db.missao.findUnique({ where: { id: missaoId } });
  if (!missao) return { error: "Missão não encontrada." };
  if (!missao.cercoPublicado) return { error: "Inscrições encerradas no momento." };

  const servosDaMissao = await db.servo.findMany({
    where: { missaoId, status: "ATIVO" },
    include: { pessoa: true },
  });
  const existente = servosDaMissao.find(
    (s) => s.pessoa.nome.trim().toLowerCase() === nome.toLowerCase()
  );
  if (!existente) {
    return { error: "Nome não encontrado na lista de servos desta missão. Selecione seu nome nas sugestões." };
  }
  // o setor vem do cadastro do servo: a pessoa não precisa (nem pode) escolher
  if (!existente.setor) {
    return { error: "Seu cadastro está sem setor. Fale com a coordenação para ajustar." };
  }

  // reserva atômica: se lotou entre a tela e o envio, ninguém passa do limite
  let reservou: boolean;
  try {
    reservou = await reservarHorarioCerco(db, {
      servoId: existente.id,
      missaoId,
      horario,
      max: missao.cercoMaxPorHorario,
    });
  } catch {
    return { error: "Não foi possível registrar agora. Tente de novo em instantes." };
  }
  if (!reservou) {
    return { error: `Esse horário já atingiu o limite de ${missao.cercoMaxPorHorario} pessoas. Escolha outro.` };
  }

  notificarPushbird(
    "cerco",
    "Cerco de Jericó",
    `${existente.pessoa.nome} (${existente.setor}) escolheu ${horario}h`,
    missao.nome
  );

  revalidatePath(`/cerco/${missao.cercoSlug}`);
  revalidatePath("/cerco-dashboard");
  return {
    ok: true,
    comprovante: {
      nome: existente.pessoa.nome,
      setor: existente.setor,
      horario,
      missao: missao.nome,
      registradoEm: new Date().toISOString(),
    },
  } as const;
}

// ---------- neocampistas ----------
function fichaData(formData: FormData) {
  const s = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : String(v);
  };
  const n = (k: string) => (formData.get(k) ? Number(String(formData.get(k)).replace(",", ".")) : null);
  return {
    nucleo: String(formData.get("nucleo")),
    nome: normalizarNome(String(formData.get("nome"))),
    endereco: s("endereco"),
    bairro: s("bairro"),
    cidade: s("cidade"),
    celular: s("celular"),
    idade: n("idade") ? Math.round(n("idade")!) : null,
    altura: n("altura"),
    peso: n("peso"),
    sexo: s("sexo"),
    camiseta: s("camiseta"),
    pagamento: s("pagamento"),
    situacao: String(formData.get("situacao") || "OK"),
    observacao: s("observacao"),
    cpf: s("cpf"),
  };
}

export async function criarFicha(formData: FormData) {
  const usuario = await requireUser();
  if (!String(formData.get("cpf") ?? "").trim()) throw new Error("CPF é obrigatório.");
  const missaoId = Number(formData.get("missaoId"));
  await exigirMissao(usuario, missaoId);
  let numero = Math.round(Number(formData.get("numero")));
  if (!formData.get("numero") || !(numero > 0)) {
    const max = await db.neocampista.aggregate({ where: { missaoId }, _max: { numero: true } });
    numero = (max._max.numero || 0) + 1;
  } else if (await db.neocampista.findUnique({ where: { missaoId_numero: { missaoId, numero } } })) {
    throw new Error(`Já existe a ficha número ${numero} nesta missão.`);
  }
  await db.neocampista.create({
    data: { missaoId, numero, ...fichaData(formData) },
  });
  revalidatePath("/fichas");
}

export async function atualizarFicha(formData: FormData) {
  const usuario = await requireUser();
  if (!String(formData.get("cpf") ?? "").trim()) throw new Error("CPF é obrigatório.");
  const id = Number(formData.get("id"));
  await exigirRegistros(usuario, ["ficha", id]);
  const numero = Math.round(Number(formData.get("numero")));
  if (!(numero > 0)) throw new Error("Número da ficha inválido.");
  const atual = await db.neocampista.findUniqueOrThrow({ where: { id } });
  if (numero !== atual.numero) {
    const dup = await db.neocampista.findUnique({ where: { missaoId_numero: { missaoId: atual.missaoId, numero } } });
    if (dup) throw new Error(`Já existe a ficha número ${numero} nesta missão.`);
  }
  await db.neocampista.update({ where: { id }, data: { ...fichaData(formData), numero } });
  revalidatePath("/fichas");
  redirect("/fichas");
}

export async function excluirFicha(formData: FormData) {
  const usuario = await requireUser();
  const id = Number(formData.get("id"));
  await exigirRegistros(usuario, ["ficha", id]);
  await db.fichaAlerta.deleteMany({ where: { OR: [{ origemId: id }, { alvoId: id }] } });
  await db.neocampista.delete({ where: { id } });
  revalidatePath("/fichas");
}

export async function adicionarAlerta(formData: FormData) {
  const usuario = await requireUser();
  const origemId = Number(formData.get("origemId"));
  const alvoId = Number(formData.get("alvoId"));
  // as duas fichas precisam ser da mesma missão a que o usuário tem acesso
  await exigirRegistros(usuario, ["ficha", origemId], ["ficha", alvoId]);
  if (origemId && alvoId && origemId !== alvoId) {
    await db.fichaAlerta.upsert({
      where: { origemId_alvoId: { origemId, alvoId } },
      update: {},
      create: { origemId, alvoId },
    });
  }
  revalidatePath("/fichas");
  revalidatePath("/tribos");
}

export async function removerAlerta(formData: FormData) {
  const usuario = await requireUser();
  const id = Number(formData.get("id"));
  await exigirRegistros(usuario, ["alerta", id]);
  await db.fichaAlerta.delete({ where: { id } });
  revalidatePath("/fichas");
  revalidatePath("/tribos");
}

// ---------- tribos ----------
export async function alocarTribo(_prev: unknown, formData: FormData) {
  const usuario = await requireUser();
  const fichaId = Number(formData.get("fichaId"));
  const triboIdRaw = formData.get("triboId");
  const triboId = triboIdRaw ? Number(triboIdRaw) : null;
  // ficha e tribo precisam ser da mesma missão a que o usuário tem acesso
  const refs: [["ficha", number], ...Array<["tribo", number]>] = triboId ? [["ficha", fichaId], ["tribo", triboId]] : [["ficha", fichaId]];
  if (!(await acessoRegistros(usuario, ...refs))) return { error: "Sem acesso a esta ficha ou tribo." };

  if (triboId) {
    // trava: nenhuma ficha-alerta pode estar na mesma tribo
    const alertas = await db.fichaAlerta.findMany({
      where: { OR: [{ origemId: fichaId }, { alvoId: fichaId }] },
      include: { origem: true, alvo: true },
    });
    for (const a of alertas) {
      const outro = a.origemId === fichaId ? a.alvo : a.origem;
      if (outro.triboId === triboId) {
        return { error: `TRAVA: ficha ${outro.numero} (${outro.nome}) já está nesta tribo (alerta de parentesco/amizade).` };
      }
    }
  }
  await db.neocampista.update({ where: { id: fichaId }, data: { triboId } });
  revalidatePath("/tribos");
  return { ok: true };
}

function mediaLista(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// sorteio balanceado de fichas sem tribo, respeitando pares de FichaAlerta
export async function sortearTribos(_prev: unknown, formData: FormData) {
  const usuario = await requireUser();
  const missaoId = Number(formData.get("missaoId"));
  if (!(await podeAcessarMissao(usuario, missaoId))) return { error: "Sem acesso a esta missão." };

  const tribos = await db.tribo.findMany({
    where: { missaoId },
    include: { neocampistas: true },
    orderBy: { nome: "asc" },
  });
  if (!tribos.length) return { error: "Nenhuma tribo cadastrada para esta missão." };

  const fichasSemTribo = await db.neocampista.findMany({
    where: { missaoId, triboId: null, situacao: "OK" },
    orderBy: { numero: "asc" },
  });
  if (!fichasSemTribo.length) return { ok: true, alocadas: 0, pendentes: [] as string[] };

  const alertas = await db.fichaAlerta.findMany({
    where: {
      OR: [
        { origem: { missaoId } },
        { alvo: { missaoId } },
      ],
    },
  });
  const proibidos = new Map<number, Set<number>>();
  const addProibido = (a: number, b: number) => {
    if (!proibidos.has(a)) proibidos.set(a, new Set());
    proibidos.get(a)!.add(b);
  };
  for (const a of alertas) {
    addProibido(a.origemId, a.alvoId);
    addProibido(a.alvoId, a.origemId);
  }

  // estado mutável de cada tribo (membros já alocados, manual + os que forem entrando no sorteio)
  type EstadoTribo = {
    id: number;
    membros: Set<number>;
    homens: number;
    mulheres: number;
    idades: number[];
    pesos: number[];
    alturas: number[];
  };
  const estados: EstadoTribo[] = tribos.map((t) => ({
    id: t.id,
    membros: new Set(t.neocampistas.map((n) => n.id)),
    homens: t.neocampistas.filter((n) => n.sexo === "MASCULINO").length,
    mulheres: t.neocampistas.filter((n) => n.sexo === "FEMININO").length,
    idades: t.neocampistas.map((n) => n.idade).filter((x): x is number => x != null),
    pesos: t.neocampistas.map((n) => n.peso).filter((x): x is number => x != null),
    alturas: t.neocampistas.map((n) => n.altura).filter((x): x is number => x != null),
  }));

  // médias globais de referência (todas as fichas OK da missão) para o critério de desempate
  const todasFichas = await db.neocampista.findMany({ where: { missaoId, situacao: "OK" } });
  const idadeGlobal = mediaLista(todasFichas.map((f) => f.idade).filter((x): x is number => x != null));
  const pesoGlobal = mediaLista(todasFichas.map((f) => f.peso).filter((x): x is number => x != null));
  const alturaGlobal = mediaLista(todasFichas.map((f) => f.altura).filter((x): x is number => x != null));

  // embaralha e depois alterna sexos (M, F, outros) pra distribuir o sorteio no tempo
  function embaralhar<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const homens = embaralhar(fichasSemTribo.filter((f) => f.sexo === "MASCULINO"));
  const mulheres = embaralhar(fichasSemTribo.filter((f) => f.sexo === "FEMININO"));
  const outros = embaralhar(fichasSemTribo.filter((f) => f.sexo !== "MASCULINO" && f.sexo !== "FEMININO"));
  const ordemSorteio: typeof fichasSemTribo = [];
  let ih = 0, im = 0, io = 0;
  while (ih < homens.length || im < mulheres.length || io < outros.length) {
    if (ih < homens.length) ordemSorteio.push(homens[ih++]);
    if (im < mulheres.length) ordemSorteio.push(mulheres[im++]);
    if (io < outros.length) ordemSorteio.push(outros[io++]);
  }

  const alocacoes = new Map<number, number>(); // fichaId -> triboId
  const pendentes: string[] = [];

  for (const ficha of ordemSorteio) {
    const proibidosDaFicha = proibidos.get(ficha.id);
    const elegiveis = estados.filter((e) => {
      if (!proibidosDaFicha || proibidosDaFicha.size === 0) return true;
      for (const membroId of e.membros) {
        if (proibidosDaFicha.has(membroId)) return false;
      }
      return true;
    });

    if (elegiveis.length === 0) {
      pendentes.push(`#${ficha.numero} ${ficha.nome}`);
      continue;
    }

    const contagemSexo = (e: EstadoTribo) =>
      ficha.sexo === "MASCULINO" ? e.homens : ficha.sexo === "FEMININO" ? e.mulheres : e.homens + e.mulheres;
    const total = (e: EstadoTribo) => e.homens + e.mulheres;
    const desvio = (e: EstadoTribo) => {
      const idadeNova = ficha.idade != null ? [...e.idades, ficha.idade] : e.idades;
      const pesoNovo = ficha.peso != null ? [...e.pesos, ficha.peso] : e.pesos;
      const alturaNova = ficha.altura != null ? [...e.alturas, ficha.altura] : e.alturas;
      return (
        Math.abs(mediaLista(idadeNova) - idadeGlobal) +
        Math.abs(mediaLista(pesoNovo) - pesoGlobal) +
        Math.abs(mediaLista(alturaNova) - alturaGlobal)
      );
    };

    elegiveis.sort((a, b) => {
      const bySexo = contagemSexo(a) - contagemSexo(b);
      if (bySexo !== 0) return bySexo;
      const byTotal = total(a) - total(b);
      if (byTotal !== 0) return byTotal;
      return desvio(a) - desvio(b);
    });

    const escolhida = elegiveis[0];
    escolhida.membros.add(ficha.id);
    if (ficha.sexo === "MASCULINO") escolhida.homens++;
    else if (ficha.sexo === "FEMININO") escolhida.mulheres++;
    if (ficha.idade != null) escolhida.idades.push(ficha.idade);
    if (ficha.peso != null) escolhida.pesos.push(ficha.peso);
    if (ficha.altura != null) escolhida.alturas.push(ficha.altura);
    alocacoes.set(ficha.id, escolhida.id);
  }

  for (const [fichaId, triboId] of alocacoes) {
    await db.neocampista.update({ where: { id: fichaId }, data: { triboId } });
  }

  revalidatePath("/tribos");
  return { ok: true, alocadas: alocacoes.size, pendentes };
}

export async function adicionarLiderTribo(formData: FormData) {
  const usuario = await requireUser();
  const triboId = Number(formData.get("triboId"));
  const servoId = Number(formData.get("servoId"));
  // a tribo e o servo precisam ser da mesma missão a que o usuário tem acesso
  await exigirRegistros(usuario, ["tribo", triboId], ["servo", servoId]);
  if (triboId && servoId) {
    await db.triboLider.upsert({
      where: { triboId_servoId: { triboId, servoId } },
      update: {},
      create: { triboId, servoId },
    });
  }
  revalidatePath("/tribos");
}

export async function removerLiderTribo(formData: FormData) {
  const usuario = await requireUser();
  const id = Number(formData.get("id"));
  await exigirRegistros(usuario, ["liderTribo", id]);
  await db.triboLider.delete({ where: { id } });
  revalidatePath("/tribos");
}

// ---------- possíveis duplicatas de Pessoa ----------
export async function fundirPessoas(formData: FormData) {
  await requireRole("SUPER");
  const manterId = Number(formData.get("manterId"));
  const removerId = Number(formData.get("removerId"));
  if (!manterId || !removerId || manterId === removerId) return;

  const manter = await db.pessoa.findUnique({ where: { id: manterId } });
  const remover = await db.pessoa.findUnique({ where: { id: removerId }, include: { servos: true } });
  if (!manter || !remover) return;

  // completa campos vazios do cadastro que fica
  const preencher: Record<string, string> = {};
  for (const campo of ["cpf", "celular", "endereco", "bairro", "cidade", "paroquia", "sexo", "camiseta", "email", "aniversario"] as const) {
    if (remover[campo] && !manter[campo]) preencher[campo] = remover[campo]!;
  }
  if (Object.keys(preencher).length) {
    await db.pessoa.update({ where: { id: manterId }, data: preencher });
  }

  // transfere participações em missões; se ambos serviram na mesma missão, descarta a do removido
  for (const s of remover.servos) {
    const jaExiste = await db.servo.findUnique({
      where: { missaoId_pessoaId: { missaoId: s.missaoId, pessoaId: manterId } },
    });
    if (jaExiste) {
      await db.triboLider.deleteMany({ where: { servoId: s.id } });
      await db.servo.delete({ where: { id: s.id } });
    } else {
      await db.servo.update({ where: { id: s.id }, data: { pessoaId: manterId } });
    }
  }

  await db.duplicataIgnorada.deleteMany({
    where: { OR: [{ pessoa1Id: removerId }, { pessoa2Id: removerId }] },
  });
  await db.pessoa.delete({ where: { id: removerId } });
  revalidatePath("/duplicatas");
}

// ---------- usuários (SUPER only) ----------
export async function criarUsuario(_prev: unknown, formData: FormData) {
  await requireRole("SUPER");
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const role = normalizarRole(formData.get("role"));
  const setorInformado = String(formData.get("setor") || "").trim();
  const missaoIds = formData.getAll("missaoIds").map(Number).filter((n) => !Number.isNaN(n));

  if (!nome || !email || senha.length < 10) {
    return { error: "Preencha nome, e-mail e uma senha com pelo menos 10 caracteres." };
  }
  if (role !== "SUPER" && missaoIds.length === 0) {
    return { error: "Selecione ao menos uma missão para este usuário." };
  }
  if (role === "COORDENADOR" && !(await db.setor.findUnique({ where: { nome: setorInformado } }))) {
    return { error: "Escolha o setor do coordenador." };
  }
  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) return { error: "Já existe um usuário com esse e-mail." };
  const hash = await bcrypt.hash(senha, 10);
  const usuario = await db.usuario.create({
    data: { nome, email, senha: hash, role, setor: role === "COORDENADOR" ? setorInformado : null },
  });
  if (role !== "SUPER") {
    await db.usuarioMissao.createMany({
      data: missaoIds.map((missaoId) => ({ usuarioId: usuario.id, missaoId })),
    });
  }
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function atualizarUsuario(_prev: unknown, formData: FormData) {
  const atual = await requireRole("SUPER");
  const id = Number(formData.get("id"));
  const nome = String(formData.get("nome") || "").trim();
  const role = normalizarRole(formData.get("role"));
  const setorInformado = String(formData.get("setor") || "").trim();
  const missaoIds = formData.getAll("missaoIds").map(Number).filter((n) => !Number.isNaN(n));
  const novaSenha = String(formData.get("novaSenha") || "");

  if (!id || !nome) return { error: "Preencha o nome." };
  if (id === atual.id && role !== "SUPER") {
    return { error: "Você não pode remover o seu próprio acesso de SUPER." };
  }
  if (role !== "SUPER" && missaoIds.length === 0) {
    return { error: "Selecione ao menos uma missão para este usuário." };
  }
  if (role === "COORDENADOR" && !(await db.setor.findUnique({ where: { nome: setorInformado } }))) {
    return { error: "Escolha o setor do coordenador." };
  }
  if (novaSenha && novaSenha.length < 10) {
    return { error: "A nova senha precisa ter pelo menos 10 caracteres." };
  }

  const senhaHash = novaSenha ? await bcrypt.hash(novaSenha, 10) : undefined;

  await db.$transaction([
    db.usuario.update({
      where: { id },
      data: {
        nome,
        role,
        setor: role === "COORDENADOR" ? setorInformado : null, // sai de COORDENADOR → setor é limpo
        ...(senhaHash ? { senha: senhaHash, sessaoVersao: { increment: 1 } } : {}),
      },
    }),
    db.usuarioMissao.deleteMany({ where: { usuarioId: id } }),
    ...(role !== "SUPER"
      ? [
          db.usuarioMissao.createMany({
            data: missaoIds.map((missaoId) => ({ usuarioId: id, missaoId })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function excluirUsuario(formData: FormData) {
  const atual = await requireRole("SUPER");
  const id = Number(formData.get("id"));
  if (id === atual.id) return; // proteção: não se auto-excluir (o link já fica oculto na UI)
  await db.usuario.delete({ where: { id } });
  revalidatePath("/usuarios");
}

export async function ignorarDuplicata(formData: FormData) {
  await requireRole("SUPER");
  const a = Number(formData.get("pessoa1Id"));
  const b = Number(formData.get("pessoa2Id"));
  if (!a || !b) return;
  const [pessoa1Id, pessoa2Id] = a < b ? [a, b] : [b, a];
  await db.duplicataIgnorada.upsert({
    where: { pessoa1Id_pessoa2Id: { pessoa1Id, pessoa2Id } },
    update: {},
    create: { pessoa1Id, pessoa2Id },
  });
  revalidatePath("/duplicatas");
}

// ---------- cerco público ----------
export async function alternarCercoPublicado(missaoId: number, publicado: boolean) {
  await requireRole("SUPER");
  await db.missao.update({ where: { id: missaoId }, data: { cercoPublicado: publicado } });
  revalidatePath("/configuracoes");
  revalidatePath("/cerco/[slug]", "page");
}

// ---------- exportação em Excel: pessoas ocultas ----------
export async function definirOcultarNaExportacao(pessoaId: number, ocultar: boolean) {
  await requireRole("SUPER");
  await db.pessoa.update({ where: { id: pessoaId }, data: { ocultarNaExportacao: ocultar } });
  revalidatePath("/configuracoes");
}

// ---------- dispositivos Pushbird (notificações push) ----------
export async function criarPushbirdDevice(formData: FormData) {
  await requireRole("SUPER");
  const nome = String(formData.get("nome") || "").trim();
  const webhookUrl = String(formData.get("webhookUrl") || "").trim();
  if (!nome || !webhookUrl) return;
  await db.pushbirdDevice.create({
    data: {
      nome,
      webhookUrl,
      notificarConflito: formData.get("notificarConflito") === "on",
      notificarCerco: formData.get("notificarCerco") === "on",
      notificarQuadrante: formData.get("notificarQuadrante") === "on",
    },
  });
  revalidatePath("/configuracoes");
}

export async function atualizarPushbirdDevice(formData: FormData) {
  await requireRole("SUPER");
  const id = Number(formData.get("id"));
  const nome = String(formData.get("nome") || "").trim();
  const webhookUrl = String(formData.get("webhookUrl") || "").trim();
  if (!id || !nome || !webhookUrl) return;
  await db.pushbirdDevice.update({
    where: { id },
    data: {
      nome,
      webhookUrl,
      notificarConflito: formData.get("notificarConflito") === "on",
      notificarCerco: formData.get("notificarCerco") === "on",
      notificarQuadrante: formData.get("notificarQuadrante") === "on",
    },
  });
  revalidatePath("/configuracoes");
}

export async function excluirPushbirdDevice(formData: FormData) {
  await requireRole("SUPER");
  await db.pushbirdDevice.delete({ where: { id: Number(formData.get("id")) } });
  revalidatePath("/configuracoes");
}
