// Núcleos que aparecem para escolher na ficha do neocampista (Fichas › Nova ficha / Ver/Editar).
// Para acrescentar ou mudar um núcleo, edite esta lista.
export const NUCLEOS = [
  "AGUAS MORNAS",
  "ALFREDO WAGNER",
  "ANGELINA",
  "ANITAPOLIS",
  "BIGUAÇU - ANTONIO CARLOS - GOV. CELSO RAMOS",
  "FLORIANOPOLIS",
  "LEOBERTO LEAL",
  "PALHOÇA - ARIRIU",
  "PALHOÇA - CENTRO",
  "PALHOÇA - PONTE DO IMARUIM",
  "PALHOÇA - SÃO SEBASTIÃO",
  "PAULO LOPES / GAROPABA",
  "SANTO AMARO DA IMPERATRIZ",
  "SÃO JOSÉ - SÃO PEDRO",
  "EMERGENCIAS",
  "EMERGENCIAS - PADRES",
] as const;

// Ficha nova: só núcleo da lista. Ficha antiga com núcleo escrito de outro jeito (importações) pode ser salva
// mantendo o valor atual, até alguém escolher um da lista.
export function nucleoAceito(valor: string, atual?: string | null): boolean {
  const v = valor.trim();
  if (!v) return false;
  return (NUCLEOS as readonly string[]).includes(v) || (atual != null && v === atual.trim());
}
