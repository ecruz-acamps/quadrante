export type MapaApelidos = Map<string, number>;
export type Vizinhanca = Set<string>;

export function normalizarCidade(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(.+?) sc$/, "$1");
}

export function resolverCidade(
  texto: string | null | undefined,
  mapa: MapaApelidos
): number | null {
  if (!texto) return null;
  const chave = normalizarCidade(texto);
  if (!chave) return null;
  return mapa.get(chave) ?? null;
}

export function chaveVizinha(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function saoVizinhas(v: Vizinhanca, a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false;
  return v.has(chaveVizinha(a, b));
}
