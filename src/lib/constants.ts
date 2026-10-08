export const HORARIOS_CERCO = Array.from({ length: 24 }, (_, h) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:00 - ${p((h + 1) % 24)}:00`;
});

export const CAMISETAS = ["PP", "P", "M", "G", "GG", "X1", "X2", "X3", "XG", "X4"];

export const FUNCOES = ["COORDENADOR", "AUXILIAR", "APOIO", "INTEGRANTE"];

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
