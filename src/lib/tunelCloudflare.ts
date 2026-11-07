import {
  ErroCloudflare,
  hostnameValido,
  verificarToken,
  localizarZona,
  lerRegistroDns,
  criarTunel,
  definirRota,
  gravarRegistroDns,
  type FetchFn,
} from "./cloudflare";

export const SERVICO_LOCAL = "http://localhost:4008";

export type EntradaTunel = { tokenApi: string; hostname: string; confirmarTrocaDns: boolean };

export type ResultadoTunel =
  | { estado: "OK"; hostname: string; tunelId: string }
  | { estado: "CONFIRMAR_TROCA"; atual: { tipo: string; conteudo: string } };

export type DependenciasTunel = { fetch: FetchFn; ligar: (tokenTunel: string) => Promise<void> };

function nomeDoTunel(): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  return `quadrante-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Cria o túnel na Cloudflare, aponta o endereço para este servidor e liga o serviço local.
// Ordem pensada para falhar sem estrago: valida tudo → (se o DNS já existe, pede confirmação ANTES de criar qualquer coisa)
// → cria túnel → define rota → liga o serviço → só então troca o DNS (o tráfego só muda quando o túnel local está de pé).
// O token da API é só usado aqui: não é devolvido, gravado nem incluído em mensagens.
export async function criarEAtivarTunel(e: EntradaTunel, d: DependenciasTunel): Promise<ResultadoTunel> {
  if (!hostnameValido(e.hostname)) {
    throw new ErroCloudflare(400, "Endereço inválido. Use só letras minúsculas, números, hífens e pontos (ex.: quadrante.suaorganizacao.com.br).");
  }
  await verificarToken(d.fetch, e.tokenApi);
  const { contaId, zonaId } = await localizarZona(d.fetch, e.tokenApi, e.hostname);

  const existente = await lerRegistroDns(d.fetch, e.tokenApi, zonaId, e.hostname);
  if (existente && !e.confirmarTrocaDns) {
    return { estado: "CONFIRMAR_TROCA", atual: { tipo: existente.tipo, conteudo: existente.conteudo } };
  }

  const tunel = await criarTunel(d.fetch, e.tokenApi, contaId, nomeDoTunel());
  await definirRota(d.fetch, e.tokenApi, contaId, tunel.id, e.hostname, SERVICO_LOCAL);
  await d.ligar(tunel.tokenTunel);
  await gravarRegistroDns(d.fetch, e.tokenApi, zonaId, e.hostname, tunel.id, existente?.id);
  return { estado: "OK", hostname: e.hostname, tunelId: tunel.id };
}

// A confirmação da troca de DNS vale só para o endereço que foi MOSTRADO ao dono na tela de confirmação:
// se ele editar o campo depois de ver o aviso, precisa confirmar de novo.
export function confirmaTroca(
  campos: { confirmar?: string | null; confirmarHostname?: string | null },
  hostname: string,
): boolean {
  const norm = (t: string) => t.trim().toLowerCase();
  return campos.confirmar === "1" && !!campos.confirmarHostname && norm(campos.confirmarHostname) === norm(hostname);
}
