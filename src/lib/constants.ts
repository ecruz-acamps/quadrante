export const HORARIOS_CERCO = Array.from({ length: 24 }, (_, h) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:00 - ${p((h + 1) % 24)}:00`;
});

export const CAMISETAS = ["PP", "P", "M", "G", "GG", "X1", "X2", "X3", "XG", "X4"];

export const FUNCOES = ["COORDENADOR", "AUXILIAR", "APOIO", "INTEGRANTE"];

// ordem de exibição dos setores no quadrante; setores fora da lista vão para o fim, por nome
export const ORDEM_SETORES = [
  "DIRETOR ESPIRITUAL",
  "CONDUÇÃO/PREGADOR",
  "COORDENADORES DA MISSÃO",
  "SECRETARIA",
  "ANIMAÇÃO",
  "TEATRO",
  "MÚSICA",
  "CAPELA",
  "COZINHA",
  "MANUTENÇÃO",
  "TROPA DE ELITE",
  "CANTINHO MARIANO",
  "FARMÁCIA",
  "LIGAÇÃO",
  "LÍDERES",
  "EVANGELIZAÇÃO",
];

export function ordenarSetores<T extends { nome: string }>(setores: T[]): T[] {
  const idx = (n: string) => {
    const i = ORDEM_SETORES.indexOf(n);
    return i === -1 ? ORDEM_SETORES.length : i;
  };
  return [...setores].sort((a, b) => idx(a.nome) - idx(b.nome) || a.nome.localeCompare(b.nome, "pt-BR"));
}

// setores em que servir várias vezes seguidas é normal: não geram o alerta de "mais de 2 vezes no mesmo setor"
export const SETORES_SEM_ALERTA_CONSECUTIVO = ["DIRETOR ESPIRITUAL"];

export const PAGAMENTOS = ["DINHEIRO", "PIX", "DÉBITO", "ISENTO", "PAGO OUTRA MISSAO"];

export const TIPOS_MISSAO = ["MIRIM", "FAC", "JUVENIL", "SENIOR", "CASAIS"];

export const CORES_TRIBO = [
  "TRIBO AZUL",
  "TRIBO VERMELHA",
  "TRIBO VERDE",
  "TRIBO AMARELA",
  "TRIBO LARANJA",
  "TRIBO ROXA",
  "TRIBO PRETA",
  "TRIBO MARROM",
];

export const COR_TRIBO_HEX: Record<string, string> = {
  "TRIBO AZUL": "#2255A4",
  "TRIBO VERMELHA": "#B4342A",
  "TRIBO VERDE": "#2E7D46",
  "TRIBO AMARELA": "#D9A62E",
  "TRIBO LARANJA": "#D2691E",
  "TRIBO ROXA": "#6B3FA0",
  "TRIBO PRETA": "#2A2A2A",
  "TRIBO MARROM": "#6B4226",
};

export const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];
