import { cpfValido, soDigitos } from "./cpf";
import { normalizarNome } from "./nomes";

export const TIPOS_PERGUNTA = [
  "TEXTO_CURTO", "TEXTO_LONGO", "SIM_NAO", "ESCOLHA_UMA", "ESCOLHA_VARIAS", "NUMERO", "DATA",
] as const;
export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number];

// valor enviado no lugar da opção quando a pessoa escolhe "Outra" (o texto vai em `outra`)
export const OUTRA = "__outra__";

export type PerguntaForm = {
  id: number;
  titulo: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  opcoes: string[];
  permiteOutra: boolean;
};

// `perguntaId` precisa ser a primeira chave: a checagem "pergunta já tem respostas" procura `"perguntaId":<id>,`
export type RespostaSalva = { perguntaId: number; titulo: string; tipo: TipoPergunta; valor: string | string[] };
export type EntradaResposta = { valores: string[]; outra?: string };

export const LIMITE_TEXTO_CURTO = 200;
export const LIMITE_TEXTO_LONGO = 2000;

function dataReal(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mes - 1, dia));
  return d.getUTCFullYear() === a && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// valida e converte a entrada de uma pergunta; devolve o valor a guardar, null (em branco) ou um erro
function validarUma(p: PerguntaForm, e: EntradaResposta | undefined): { valor: string | string[] | null } | { erro: string } {
  const valores = (e?.valores ?? []).map((v) => v.trim()).filter((v) => v !== "");
  if (valores.length === 0) return p.obrigatoria ? { erro: "Resposta obrigatória." } : { valor: null };

  switch (p.tipo) {
    case "TEXTO_CURTO":
    case "TEXTO_LONGO": {
      const limite = p.tipo === "TEXTO_CURTO" ? LIMITE_TEXTO_CURTO : LIMITE_TEXTO_LONGO;
      if (valores.length !== 1) return { erro: "Resposta inválida." };
      if (valores[0].length > limite) return { erro: `Use no máximo ${limite} caracteres.` };
      return { valor: valores[0] };
    }
    case "SIM_NAO":
      if (valores.length !== 1 || (valores[0] !== "Sim" && valores[0] !== "Não")) return { erro: "Escolha Sim ou Não." };
      return { valor: valores[0] };
    case "NUMERO":
      if (valores.length !== 1 || valores[0].length > 12 || !/^-?\d+([.,]\d+)?$/.test(valores[0])) {
        return { erro: "Digite um número." };
      }
      return { valor: valores[0] };
    case "DATA":
      if (valores.length !== 1 || !dataReal(valores[0])) return { erro: "Informe uma data válida." };
      return { valor: valores[0] };
    case "ESCOLHA_UMA":
    case "ESCOLHA_VARIAS": {
      if (p.tipo === "ESCOLHA_UMA" && valores.length !== 1) return { erro: "Escolha apenas uma opção." };
      if (new Set(valores).size !== valores.length) return { erro: "Opção repetida." };
      const finais: string[] = [];
      for (const v of valores) {
        if (v === OUTRA) {
          const texto = (e?.outra ?? "").trim();
          if (!p.permiteOutra || !texto) return { erro: "Informe o texto de “Outra”." };
          if (texto.length > LIMITE_TEXTO_CURTO) return { erro: `Use no máximo ${LIMITE_TEXTO_CURTO} caracteres.` };
          finais.push(texto);
        } else if (p.opcoes.includes(v)) {
          finais.push(v);
        } else {
          return { erro: "Opção inválida." };
        }
      }
      return { valor: p.tipo === "ESCOLHA_UMA" ? finais[0] : finais };
    }
  }
}

export function validarRespostas(
  perguntas: PerguntaForm[],
  entrada: Record<number, EntradaResposta | undefined>
): { ok: true; respostas: RespostaSalva[] } | { ok: false; erros: Record<number, string> } {
  const respostas: RespostaSalva[] = [];
  const erros: Record<number, string> = {};
  for (const p of perguntas) {
    const r = validarUma(p, entrada[p.id]);
    if ("erro" in r) erros[p.id] = r.erro;
    else if (r.valor !== null) respostas.push({ perguntaId: p.id, titulo: p.titulo, tipo: p.tipo, valor: r.valor });
  }
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, respostas };
}

export type EntradaFixos = {
  nome: string; cpf: string; celular: string; casado: string;
  conjugeNome: string; conjugeCelular: string; disponivel: string;
};
export type DadosFixos = {
  nome: string; cpf: string; celular: string; casado: boolean;
  conjugeNome: string | null; conjugeCelular: string | null; disponivel: boolean;
};

const celularValido = (digitos: string) => digitos.length >= 10 && digitos.length <= 13;
const simNao = (v: string): boolean | null => (v === "Sim" ? true : v === "Não" ? false : null);

export function validarFixos(
  e: EntradaFixos
): { ok: true; dados: DadosFixos } | { ok: false; erros: Partial<Record<keyof EntradaFixos, string>> } {
  const erros: Partial<Record<keyof EntradaFixos, string>> = {};
  const nome = normalizarNome(e.nome);
  if (nome.length < 3 || nome.length > 120) erros.nome = "Informe seu nome completo.";
  if (!cpfValido(e.cpf)) erros.cpf = "CPF inválido.";
  const celular = soDigitos(e.celular);
  if (!celularValido(celular)) erros.celular = "Informe um celular com DDD.";
  const casado = simNao(e.casado);
  if (casado === null) erros.casado = "Informe se você é casado(a).";
  const disponivel = simNao(e.disponivel);
  if (disponivel === null) erros.disponivel = "Responda se você pode servir.";

  let conjugeNome: string | null = null;
  let conjugeCelular: string | null = null;
  if (casado) {
    conjugeNome = normalizarNome(e.conjugeNome);
    if (conjugeNome.length < 3 || conjugeNome.length > 120) erros.conjugeNome = "Informe o nome do cônjuge.";
    conjugeCelular = soDigitos(e.conjugeCelular);
    if (!celularValido(conjugeCelular)) erros.conjugeCelular = "Informe o celular do cônjuge com DDD.";
  }
  if (Object.keys(erros).length) return { ok: false, erros };
  return {
    ok: true,
    dados: { nome, cpf: soDigitos(e.cpf), celular, casado: casado!, conjugeNome, conjugeCelular, disponivel: disponivel! },
  };
}
