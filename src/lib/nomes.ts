const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "d'"]);

export function normalizarNome(nome: string): string {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!limpo) return limpo;
  return limpo
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((palavra, i) => {
      if (i > 0 && MINUSCULAS.has(palavra)) return palavra;
      // capitaliza também após hífen (ex.: "maria-clara")
      return palavra
        .split("-")
        .map((p) => (p ? p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1) : p))
        .join("-");
    })
    .join(" ");
}
