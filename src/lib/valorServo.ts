// Quanto cada servo deve pagar. Valores vêm da missão: interna (padrão) e externa (reduzido).
//  - CONDUÇÃO/PREGADOR: isento sempre
//  - EVANGELIZAÇÃO: reduzido, qualquer função
//  - LÍDERES: integrante reduzido; coordenador, auxiliar e apoio valor padrão
//  - demais setores: valor padrão
// Valor digitado na ficha do servo (pagamentoValor) vale no lugar da regra; forma ISENTO zera.

type Missao = { valorInterna: number; valorExterna: number };
type ServoValor = { setor: string; funcao: string; pagamentoValor?: number | null; pagamentoForma?: string | null };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

export function valorServo(s: ServoValor, missao: Missao): number {
  if (s.pagamentoValor != null) return s.pagamentoValor;
  if (s.pagamentoForma === "ISENTO") return 0;
  const setor = norm(s.setor);
  if (setor === "CONDUCAO/PREGADOR") return 0;
  if (setor === "EVANGELIZACAO") return missao.valorExterna;
  if (setor === "LIDERES" && s.funcao === "INTEGRANTE") return missao.valorExterna;
  return missao.valorInterna;
}
