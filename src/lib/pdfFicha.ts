// Monta o PDF único da ficha preenchida: cada foto vira uma página A4 (deitada se a foto for mais larga que
// alta), centralizada e ajustada à página; um PDF enviado entra com todas as páginas. A foto entra no PDF como
// está (sem recomprimir), então não perde qualidade.
import { PDFDocument, PageSizes } from "pdf-lib";

export type Entrada = { nome: string; conteudo: Uint8Array; ext: string };

const MARGEM = 18; // pontos (~6 mm)

export const EXTENSOES_PDF_FICHA = [".pdf", ".jpg", ".jpeg", ".png"];

// Buffer do Node pode ser um pedaço de uma área de memória maior; a pdf-lib lê a área inteira e não acha a imagem
// ("SOI not found in JPEG"). Uma cópia própria evita isso.
const bytes = (b: Uint8Array) => new Uint8Array(b);

async function abrir(base: Uint8Array | null) {
  return base ? PDFDocument.load(bytes(base), { ignoreEncryption: true }) : PDFDocument.create();
}

// acrescenta a entrada no fim do PDF (ou cria um novo); devolve o PDF e quantas páginas ela ocupou
export async function anexarAoPdf(base: Uint8Array | null, e: Entrada): Promise<{ pdf: Uint8Array; paginas: number }> {
  const doc = await abrir(base);
  let paginas = 0;
  if (e.ext === ".pdf") {
    let origem: PDFDocument;
    try {
      origem = await PDFDocument.load(bytes(e.conteudo), { ignoreEncryption: true });
    } catch {
      throw new Error(`"${e.nome}" não é um PDF válido.`);
    }
    const copiadas = await doc.copyPages(origem, origem.getPageIndices());
    for (const p of copiadas) doc.addPage(p);
    paginas = copiadas.length;
  } else if (e.ext === ".jpg" || e.ext === ".jpeg" || e.ext === ".png") {
    let img;
    try {
      img = e.ext === ".png" ? await doc.embedPng(bytes(e.conteudo)) : await doc.embedJpg(bytes(e.conteudo));
    } catch {
      throw new Error(`Não foi possível ler a imagem "${e.nome}".`);
    }
    const [a4l, a4a] = PageSizes.A4;
    const deitada = img.width > img.height;
    const [lp, ap] = deitada ? [a4a, a4l] : [a4l, a4a];
    const escala = Math.min((lp - 2 * MARGEM) / img.width, (ap - 2 * MARGEM) / img.height);
    const w = img.width * escala;
    const h = img.height * escala;
    const pagina = doc.addPage([lp, ap]);
    pagina.drawImage(img, { x: (lp - w) / 2, y: (ap - h) / 2, width: w, height: h });
    paginas = 1;
  } else {
    throw new Error(`Formato não aceito para a ficha: "${e.nome}". Use foto (JPG/PNG) ou PDF.`);
  }
  if (paginas === 0) throw new Error(`"${e.nome}" não tem páginas.`);
  return { pdf: await doc.save(), paginas };
}

// tira `quantidade` páginas a partir de `inicio` (0 = primeira); null se não sobrar nenhuma
export async function removerPaginas(pdf: Uint8Array, inicio: number, quantidade: number): Promise<{ pdf: Uint8Array; paginas: number } | null> {
  const doc = await PDFDocument.load(bytes(pdf), { ignoreEncryption: true });
  for (let i = 0; i < quantidade; i++) doc.removePage(inicio);
  const restantes = doc.getPageCount();
  return restantes === 0 ? null : { pdf: await doc.save(), paginas: restantes };
}

export async function contarPaginas(pdf: Uint8Array) {
  return (await PDFDocument.load(bytes(pdf), { ignoreEncryption: true })).getPageCount();
}
