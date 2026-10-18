// Consulta de CEP (ViaCEP): funções puras para o formulário da ficha.
export type EnderecoCep = { endereco: string; bairro: string; cidade: string };

export function cepDeTexto(texto: string): string | null {
  const digitos = texto.replace(/\D/g, "");
  return digitos.length === 8 ? digitos : null;
}

export function formatarCep(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// resposta do ViaCEP → campos da ficha; null se o CEP não existe ou a resposta é inválida
export function interpretarViaCep(resposta: unknown): EnderecoCep | null {
  if (!resposta || typeof resposta !== "object") return null;
  const r = resposta as Record<string, unknown>;
  if (r.erro || typeof r.localidade !== "string" || !r.localidade) return null;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { endereco: texto(r.logradouro), bairro: texto(r.bairro), cidade: texto(r.localidade) };
}
