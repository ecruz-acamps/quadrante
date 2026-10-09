// Formatação pt-BR de dinheiro e números. toFixed() mostra "1234.50"; aqui sai "R$ 1.234,50".
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function brl(valor: number): string {
  return moeda.format(Number.isFinite(valor) ? valor : 0);
}

export function decimal(valor: number, casas: number): string {
  return (Number.isFinite(valor) ? valor : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
