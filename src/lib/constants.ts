export const HORARIOS_CERCO = Array.from({ length: 24 }, (_, h) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:00 - ${p((h + 1) % 24)}:00`;
});

export const CAMISETAS = ["PP", "P", "M", "G", "GG", "X1", "X2", "X3", "XG", "X4"];

export const FUNCOES = ["COORDENADOR", "AUXILIAR", "APOIO", "INTEGRANTE"];

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
