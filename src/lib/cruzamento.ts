// Cruza os campistas de uma missão com os servos de todas as missões (campista não tem vínculo com Pessoa, então o casamento é pelo nome).
// Módulo puro: a página /cruzamentos só carrega os dados e chama cruzar().

export function normNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LIGACAO = new Set(["de", "da", "do", "dos", "das", "e"]);

// primeiro e último nome ("Rosalia Alzira da Rosa" → "rosalia rosa"); null se o nome tem menos de 2 partes
function chaveParcial(nome: string): string | null {
  const t = normNome(nome).split(" ").filter((p) => p.length > 1 && !LIGACAO.has(p));
  return t.length >= 2 ? `${t[0]} ${t[t.length - 1]}` : null;
}

function soDigitos(cel: string | null | undefined): string {
  return (cel ?? "").replace(/\D/g, "").replace(/^55/, "").slice(-9);
}

export type Campista = { id: number; numero: number; nome: string; celular: string | null; nucleo: string; cidade: string | null };
export type ServoReg = {
  nome: string;
  celular: string | null;
  missaoId: number;
  missaoNome: string;
  status: string; // ATIVO | RECUSOU | DESISTIU
  setor: string;
  funcao: string;
  confirmado: boolean;
};

export type Linha = {
  campista: Campista;
  noAlvo: ServoReg | null; // registro do campista na missão alvo (qualquer status)
  outrasMissoes: ServoReg[]; // registros ATIVO em outras missões
  recusouAntes: boolean; // tem RECUSOU/DESISTIU em alguma missão
  nuncaServiu: boolean; // nenhum ATIVO em lugar nenhum e fora do alvo
  avisoTelefone: string | null; // nome de outro servo do alvo com o mesmo celular (provável cônjuge)
  avisoParecido: string | null; // servo do alvo com mesmo primeiro e último nome, mas nome diferente
};

export function cruzar(campistas: Campista[], servos: ServoReg[], alvoId: number): Linha[] {
  const porNome = new Map<string, ServoReg[]>();
  for (const s of servos) {
    const k = normNome(s.nome);
    porNome.set(k, [...(porNome.get(k) ?? []), s]);
  }
  const alvo = servos.filter((s) => s.missaoId === alvoId);
  const alvoPorTel = new Map<string, ServoReg[]>();
  const alvoPorParcial = new Map<string, ServoReg[]>();
  for (const s of alvo) {
    const t = soDigitos(s.celular);
    if (t.length >= 8) alvoPorTel.set(t, [...(alvoPorTel.get(t) ?? []), s]);
    const p = chaveParcial(s.nome);
    if (p) alvoPorParcial.set(p, [...(alvoPorParcial.get(p) ?? []), s]);
  }

  return campistas.map((campista) => {
    const chave = normNome(campista.nome);
    const regs = porNome.get(chave) ?? [];
    const noAlvo = regs.find((r) => r.missaoId === alvoId) ?? null;
    const outrasMissoes = regs.filter((r) => r.missaoId !== alvoId && r.status === "ATIVO");
    const recusouAntes = regs.some((r) => r.status !== "ATIVO");
    const nuncaServiu = !noAlvo && !regs.some((r) => r.status === "ATIVO");

    const t = soDigitos(campista.celular);
    const mesmoTel = t.length >= 8 ? (alvoPorTel.get(t) ?? []).find((s) => normNome(s.nome) !== chave) : undefined;
    const p = chaveParcial(campista.nome);
    const parecido = p ? (alvoPorParcial.get(p) ?? []).find((s) => normNome(s.nome) !== chave) : undefined;

    return {
      campista,
      noAlvo,
      outrasMissoes,
      recusouAntes,
      nuncaServiu,
      avisoTelefone: !noAlvo && mesmoTel ? mesmoTel.nome : null,
      avisoParecido: !noAlvo && parecido ? parecido.nome : null,
    };
  });
}

export type FiltroCruzamento = "serviram" | "fora" | "nunca";

export function filtrar(linhas: Linha[], filtro: FiltroCruzamento): Linha[] {
  if (filtro === "serviram") return linhas.filter((l) => l.noAlvo);
  if (filtro === "fora") return linhas.filter((l) => !l.noAlvo);
  return linhas.filter((l) => l.nuncaServiu);
}
