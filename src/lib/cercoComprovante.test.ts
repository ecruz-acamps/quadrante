import { test } from "node:test";
import assert from "node:assert/strict";
import { textoComprovante, linkWhatsApp, formatarRegistro } from "./cercoComprovante";

const dados = {
  nome: "Fernando Meinshein",
  setor: "LÍDERES",
  horario: "03:00 - 04:00",
  missao: "24º Acampamento Sênior",
  registradoEm: "2026-10-09T15:30:00.000Z", // 12:30 em Brasília (UTC-3)
};

test("formatarRegistro usa o fuso de Brasília e o formato brasileiro", () => {
  assert.equal(formatarRegistro("2026-10-09T15:30:00.000Z"), "09/10/2026 às 12:30");
  assert.equal(formatarRegistro("2026-01-01T02:05:00.000Z"), "31/12/2025 às 23:05");
});

test("formatarRegistro com data inválida não quebra", () => {
  assert.equal(formatarRegistro("não é data"), "");
});

test("o texto do comprovante traz nome, setor, horário, missão e data", () => {
  const t = textoComprovante(dados);
  for (const parte of ["Cerco de Jericó", "24º Acampamento Sênior", "Fernando Meinshein", "LÍDERES", "03:00 - 04:00", "09/10/2026 às 12:30"]) {
    assert.ok(t.includes(parte), `faltou: ${parte}`);
  }
});

test("o link do WhatsApp codifica o texto (acentos, quebras de linha, &)", () => {
  const link = linkWhatsApp(textoComprovante({ ...dados, nome: "Maria & José" }));
  assert.ok(link.startsWith("https://wa.me/?text="));
  const texto = decodeURIComponent(link.slice("https://wa.me/?text=".length));
  assert.ok(texto.includes("Maria & José"));
  assert.ok(texto.includes("\n"));
  assert.equal(link.includes(" "), false, "sem espaços crus na URL");
});
