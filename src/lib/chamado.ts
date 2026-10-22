// Mensagens padrão do chamado de servo. Módulo puro: depois o envio pelo WhatsApp usa as mesmas mensagens.

// "24º Acampamento Sênior" → "24"; sem número no começo devolve null
export function numeroMissao(nome: string): string | null {
  return nome.trim().match(/^(\d+)/)?.[1] ?? null;
}

// "EVANGELIZAÇÃO" → "Evangelização"; "TROPA DE ELITE" → "Tropa De Elite"
export function nomeSetor(setor: string): string {
  return setor
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)(\S)/g, (_, esp: string, c: string) => esp + c.toLocaleUpperCase("pt-BR"));
}

export function mensagensChamado(d: { nome: string; missaoNome: string; setor: string }): [string, string, string] {
  const numero = numeroMissao(d.missaoNome);
  const acampamento = numero ? `${numero}º Acampamento Sênior` : d.missaoNome;
  return [
    `Olá,\nTudo bem?\nFalo com ${d.nome}?`,
    `Jesus te chama para servir no ${acampamento}, você aceita este chamado?`,
    `Louvado seja Deus, pelo seu SIM!\nSeu setor é ${nomeSetor(d.setor)}.`,
  ];
}

// Link da conversa no WhatsApp ("(21) 99999-8888" → "https://wa.me/5521999998888"); com texto opcional já preenchido; sem número válido devolve null
export function linkWhatsapp(celular: string | null | undefined, texto?: string): string | null {
  let d = (celular ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  d = d.replace(/^0+/, "");
  if (d.length !== 10 && d.length !== 11) return null;
  return `https://wa.me/55${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}
