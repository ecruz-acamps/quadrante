// Antes de subir: foto (JPG, PNG, HEIC do iPhone, WEBP…) vira JPEG endireitado (rotação do celular aplicada) e com
// no máximo 2000 px no lado maior — legível em A4 e leve. PDF sobe como está. O servidor junta tudo num PDF só.
const LADO_MAXIMO = 2000;
const QUALIDADE = 0.85;

export function ehPdf(f: File) {
  return f.type === "application/pdf" || /\.pdf$/i.test(f.name);
}

async function abrirImagem(f: File): Promise<{ desenho: CanvasImageSource; w: number; h: number; fechar: () => void }> {
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    return { desenho: bmp, w: bmp.width, h: bmp.height, fechar: () => bmp.close() };
  } catch {
    // Safari abre HEIC por <img> mesmo quando createImageBitmap não consegue
    const url = URL.createObjectURL(f);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { desenho: img, w: img.naturalWidth, h: img.naturalHeight, fechar: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(`Não foi possível abrir a foto "${f.name}" neste navegador. Envie como JPG ou PDF.`);
    }
  }
}

export async function prepararParaEnvio(f: File): Promise<File> {
  if (ehPdf(f)) return f;
  const { desenho, w, h, fechar } = await abrirImagem(f);
  try {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * escala);
    canvas.height = Math.round(h * escala);
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Navegador sem suporte a desenho de imagens.");
    g.fillStyle = "#fff"; // PNG transparente fica com fundo branco
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(desenho, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALIDADE));
    if (!blob) throw new Error(`Não foi possível converter a foto "${f.name}".`);
    return new File([blob], `${f.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } finally {
    fechar();
  }
}
