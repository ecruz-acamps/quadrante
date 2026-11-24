// Alertas de parentesco/amizade nas tribos.
// - Ficha ↔ ficha: as duas não podem ficar na mesma tribo.
// - Ficha ↔ líder (servo do setor LÍDERES): a ficha não pode ficar na tribo que esse líder lidera, porque o líder
//   conhece o neocampista.

// valor do campo "Não pode ficar na mesma tribo que": "ficha:12" ou "lider:7" (número sozinho = ficha, como antes)
export type AlvoAlerta = { tipo: "ficha" | "lider"; id: number };

export function lerAlvoAlerta(valor: string): AlvoAlerta | null {
  const v = valor.trim();
  const m = /^(ficha|lider):(\d+)$/.exec(v) ?? (/^\d+$/.test(v) ? ["", "ficha", v] : null);
  if (!m) return null;
  const id = Number(m[2]);
  return Number.isInteger(id) && id > 0 ? { tipo: m[1] as AlvoAlerta["tipo"], id } : null;
}

// tribos em que a ficha não pode entrar por causa dos líderes que a conhecem
export function tribosProibidasPorLideres(servosQueConhecem: Iterable<number>, lideres: { triboId: number; servoId: number }[]): Set<number> {
  const conhecem = new Set(servosQueConhecem);
  return new Set(lideres.filter((l) => conhecem.has(l.servoId)).map((l) => l.triboId));
}
