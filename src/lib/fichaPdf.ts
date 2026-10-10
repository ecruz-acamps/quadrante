import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";

// Gera as fichas a partir do PDF modelo (assets/ficha-modelo.pdf): o modelo é mantido idêntico e só
// são trocados o nº da missão, a data e o nº da ficha, cobrindo o original e redesenhando o texto.
const MODELO = path.join(process.cwd(), "assets", "ficha-modelo.pdf");
const BRANCO = rgb(1, 1, 1);
const PRETO = rgb(0, 0, 0);

// caixas do texto original (coordenadas do pdftotext, y de cima para baixo)
type Caixa = { x0: number; y0: number; x1: number; y1: number };
const NUM_FICHA: Caixa[] = [
  { x0: 489.48, y0: 105.1, x1: 525.48, y1: 131.66 },
  { x0: 508.56, y0: 18.2, x1: 544.56, y1: 44.78 },
  { x0: 507.84, y0: 17.0, x1: 543.84, y1: 43.58 },
  { x0: 510.36, y0: 11.98, x1: 546.36, y1: 38.54 },
];

function cobrir(page: PDFPage, c: Caixa, folga = 1.5) {
  const h = page.getHeight();
  page.drawRectangle({
    x: c.x0 - folga,
    y: h - c.y1 - folga,
    width: c.x1 - c.x0 + folga * 2,
    height: c.y1 - c.y0 + folga * 2,
    color: BRANCO,
  });
}

// substitui uma linha de texto centralizada na mesma posição horizontal do original
function trocarLinhaCentralizada(page: PDFPage, c: Caixa, texto: string, font: PDFFont, size: number) {
  cobrir(page, c, 2);
  const h = page.getHeight();
  const cx = (c.x0 + c.x1) / 2;
  const w = font.widthOfTextAtSize(texto, size);
  // linha de base ≈ borda inferior da caixa menos o descendente
  const y = h - c.y1 + (c.y1 - c.y0) * 0.22;
  page.drawText(texto, { x: cx - w / 2, y, size, font, color: PRETO });
}

export type Opcoes = { missao: string; data: string };

async function gerarFicha(modelo: Uint8Array, numero: number, { missao, data }: Opcoes) {
  const doc = await PDFDocument.load(modelo);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const boldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const [p1, p2, p3, p4] = doc.getPages();
  const nFicha = String(numero).padStart(3, "0");
  const m = `${missao}º`;

  // página 1: título e data
  trocarLinhaCentralizada(p1, { x0: 213.84, y0: 65.95, x1: 381.42, y1: 83.08 }, `${m} ACAMPAMENTO SÊNIOR`, bold, 14);
  trocarLinhaCentralizada(p1, { x0: 218.16, y0: 83.14, x1: 377.32, y1: 97.78 }, data, regular, 11);
  // página 2: "Uso de Imagem dos participantes do Nº Acampamento Sênior."
  trocarLinhaCentralizada(
    p2,
    { x0: 133.92, y0: 594.59, x1: 455.86, y1: 607.87 },
    `Uso de Imagem dos participantes do ${m} Acampamento Sênior.`,
    bold,
    11.5,
  );
  // página 3: linha do anexo de medicações
  trocarLinhaCentralizada(p3, { x0: 131.04, y0: 64.48, x1: 464.52, y1: 78.19 }, `${m} ACAMPAMENTO SÊNIOR – ${data}.`, boldItalic, 12.5);

  // número da ficha nas 4 páginas
  [p1, p2, p3, p4].forEach((page, i) => {
    const c = NUM_FICHA[i];
    cobrir(page, c, 2);
    const size = 24;
    const w = bold.widthOfTextAtSize(nFicha, size);
    page.drawText(nFicha, { x: (c.x0 + c.x1) / 2 - w / 2, y: page.getHeight() - c.y1 + 5, size, font: bold, color: PRETO });
  });
  return doc.save();
}

export async function gerarZipFichas(opts: Opcoes & { inicio: number; quantidade: number }) {
  const modelo = new Uint8Array(fs.readFileSync(MODELO));
  const zip = new JSZip();
  for (let i = 0; i < opts.quantidade; i++) {
    const numero = opts.inicio + i;
    zip.file(`ficha-${String(numero).padStart(3, "0")}.pdf`, await gerarFicha(modelo, numero, opts));
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export { gerarFicha };
