export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function todosIguais(d: string): boolean {
  return /^(\d)\1+$/.test(d);
}

function digitoVerificador(base: string): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

// CPF de verdade: 11 dígitos, não repetidos, dois dígitos verificadores corretos
export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11 || todosIguais(d)) return false;
  const d1 = digitoVerificador(d.slice(0, 9));
  const d2 = digitoVerificador(d.slice(0, 9) + d1);
  return d === d.slice(0, 9) + d1 + d2;
}

// CPF "real" em dados antigos: 11 dígitos variados (não confere os verificadores; há cadastros com erro de digitação)
export function cpfReal(valor: string | null | undefined): boolean {
  if (!valor) return false;
  const d = soDigitos(valor);
  return d.length === 11 && !todosIguais(d);
}
