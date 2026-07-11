// Ordena missões pela edição extraída do nome ("1 FAC Anitapolis" → 1, "22° Acampamento Sênior" → 22).
// O campo `ano` não é usado para nada (decisão do usuário, 2026-07-08).
export function edicaoDe(nome: string): number {
  const m = nome.trim().match(/^(\d+)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

export function ordenarPorEdicao<T extends { nome: string; id: number }>(missoes: T[]): T[] {
  return [...missoes].sort((a, b) => edicaoDe(a.nome) - edicaoDe(b.nome) || a.id - b.id);
}
