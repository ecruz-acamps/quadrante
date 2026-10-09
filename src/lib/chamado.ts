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
