// Lê a resposta JSON dos envios. Se vier outra coisa (página de erro, login), devolve um erro com o código HTTP e o
// começo do texto, em vez do genérico "resposta inesperada", para dar para saber o que aconteceu.
export async function lerResposta<T extends { erro?: string }>(res: Response): Promise<T> {
  const texto = await res.text().catch(() => "");
  try {
    return JSON.parse(texto) as T;
  } catch {
    const trecho = texto
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    const redirecionou = res.redirected ? " (o servidor redirecionou para outra página; entre de novo no sistema)" : "";
    return { erro: `o servidor respondeu HTTP ${res.status}${redirecionou}${trecho ? `: ${trecho}` : ""}` } as T;
  }
}
