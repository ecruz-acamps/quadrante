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

// Telefone brasileiro: "48991234567" -> "(48) 99123-4567"; fixo "4832221100" -> "(48) 3222-1100".
// Com +55 na frente, tira o código do país. Formato que não reconhece volta como veio (aparado).
export function telefone(valor: string | null | undefined): string {
  const bruto = (valor ?? "").trim();
  let d = bruto.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
}
