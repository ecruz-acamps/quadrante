// Comprovante da inscrição no Cerco de Jericó: texto para copiar e link para compartilhar no WhatsApp.
export type DadosComprovante = {
  nome: string;
  setor: string;
  horario: string;
  missao: string;
  registradoEm: string; // ISO
};

// "09/10/2026 às 12:30", sempre no fuso de Brasília, independente do fuso do servidor ou do aparelho
export function formatarRegistro(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} às ${p("hour")}:${p("minute")}`;
}

export function textoComprovante(d: DadosComprovante): string {
  const registro = formatarRegistro(d.registradoEm);
  return [
    "Cerco de Jericó — comprovante de inscrição",
    d.missao,
    "",
    `Nome: ${d.nome}`,
    `Setor: ${d.setor}`,
    `Hora de adoração: ${d.horario}`,
    ...(registro ? [`Registrado em ${registro}`] : []),
  ].join("\n");
}

export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
