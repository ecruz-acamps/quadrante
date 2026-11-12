// Setor "LÍDERES": só quem serve nele pode ser líder de tribo.
// A comparação ignora acento e caixa porque o nome do setor aparece como "LÍDERES" e "LIDERES".
export function ehSetorLideres(setor: string): boolean {
  return setor.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase() === "LIDERES";
}
