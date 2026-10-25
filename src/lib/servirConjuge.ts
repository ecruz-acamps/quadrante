import { soDigitos } from "./cpf";

export type CandidatoConjuge = {
  id: number;
  nome: string;
  celular: string;
  casado: boolean;
  conjugeNome: string | null;
  conjugeCelular: string | null;
};

function chaveNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Para cada candidato casado, acha o outro candidato (da mesma lista) que seja o cônjuge informado:
// pelo celular, se for inequívoco, ou pelo nome. A ligação é simétrica.
export function ligarConjuges(cands: CandidatoConjuge[]): Map<number, number> {
  const ligacoes = new Map<number, number>();
  for (const a of cands) {
    if (!a.casado) continue;
    const celular = a.conjugeCelular ? soDigitos(a.conjugeCelular) : "";
    const nome = a.conjugeNome ? chaveNome(a.conjugeNome) : "";
    const outros = cands.filter((b) => b.id !== a.id);
    const porCelular = celular ? outros.filter((b) => soDigitos(b.celular) === celular) : [];
    let par = porCelular.length === 1 ? porCelular[0] : undefined;
    if (!par && nome) {
      const porNome = outros.filter((b) => chaveNome(b.nome) === nome);
      if (porNome.length === 1) par = porNome[0];
    }
    if (par) {
      ligacoes.set(a.id, par.id);
      if (!ligacoes.has(par.id)) ligacoes.set(par.id, a.id);
    }
  }
  return ligacoes;
}
