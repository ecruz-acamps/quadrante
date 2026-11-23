// Consulta de CEP (ViaCEP, com a BrasilAPI de reserva): funções puras para o formulário da ficha.
export type EnderecoCep = { endereco: string; bairro: string; cidade: string };

export function cepDeTexto(texto: string): string | null {
  const digitos = texto.replace(/\D/g, "");
  return digitos.length === 8 ? digitos : null;
}

export function formatarCep(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// O que o campo de CEP mostra enquanto se digita. Com dígitos a mais, NÃO corta: um CEP cortado em silêncio
// vira outro CEP ("881130-625" virava "88113-062") e a busca diz "não encontrado" sem explicar por quê.
export type SituacaoCep =
  | { tipo: "incompleto"; texto: string }
  | { tipo: "completo"; texto: string; cep: string }
  | { tipo: "excesso"; texto: string; digitos: number };

export function situacaoCep(texto: string): SituacaoCep {
  const d = texto.replace(/\D/g, "");
  if (d.length > 8) return { tipo: "excesso", texto: d, digitos: d.length };
  const formatado = formatarCep(d);
  return d.length === 8 ? { tipo: "completo", texto: formatado, cep: d } : { tipo: "incompleto", texto: formatado };
}

// resposta do ViaCEP → campos da ficha; null se o CEP não existe ou a resposta é inválida
export function interpretarViaCep(resposta: unknown): EnderecoCep | null {
  if (!resposta || typeof resposta !== "object") return null;
  const r = resposta as Record<string, unknown>;
  if (r.erro || typeof r.localidade !== "string" || !r.localidade) return null;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { endereco: texto(r.logradouro), bairro: texto(r.bairro), cidade: texto(r.localidade) };
}

// resposta da BrasilAPI (/api/cep/v2) → campos da ficha; null se não veio cidade
export function interpretarBrasilApi(resposta: unknown): EnderecoCep | null {
  if (!resposta || typeof resposta !== "object") return null;
  const r = resposta as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (!texto(r.city)) return null;
  return { endereco: texto(r.street), bairro: texto(r.neighborhood), cidade: texto(r.city) };
}

export type ResultadoCep = { tipo: "encontrado"; dados: EnderecoCep; fonte: string } | { tipo: "nao-encontrado" } | { tipo: "falhou" };

// Consulta feita pelo servidor: ViaCEP primeiro; se ele falhar ou não achar, a BrasilAPI (Correios e outras bases).
// "nao-encontrado" só quando um serviço respondeu e nenhum achou; "falhou" quando nenhum respondeu.
export async function buscarCepServicos(cep: string, f: typeof fetch = fetch): Promise<ResultadoCep> {
  let alguemRespondeu = false;
  const consultar = async (url: string, ms: number) => {
    const r = await f(url, { signal: AbortSignal.timeout(ms), headers: { Accept: "application/json" } });
    return { status: r.status, corpo: (await r.json().catch(() => null)) as unknown };
  };
  try {
    const v = await consultar(`https://viacep.com.br/ws/${cep}/json/`, 4000);
    if (v.status === 200 && v.corpo) {
      alguemRespondeu = true;
      const dados = interpretarViaCep(v.corpo);
      if (dados) return { tipo: "encontrado", dados, fonte: "ViaCEP" };
    }
  } catch {
    // fora do ar ou lento: tenta a reserva
  }
  try {
    const b = await consultar(`https://brasilapi.com.br/api/cep/v2/${cep}`, 6000);
    if (b.status === 200) {
      const dados = interpretarBrasilApi(b.corpo);
      if (dados) return { tipo: "encontrado", dados, fonte: "BrasilAPI" };
    }
    if (b.status === 200 || b.status === 404) alguemRespondeu = true;
  } catch {
    // também não respondeu
  }
  return alguemRespondeu ? { tipo: "nao-encontrado" } : { tipo: "falhou" };
}
