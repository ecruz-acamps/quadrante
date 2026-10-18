import { test } from "node:test";
import assert from "node:assert/strict";
import { cepDeTexto, formatarCep, interpretarViaCep } from "./cep";

test("cepDeTexto aceita 8 dígitos com ou sem máscara", () => {
  assert.equal(cepDeTexto("88130-000"), "88130000");
  assert.equal(cepDeTexto(" 88130000 "), "88130000");
  assert.equal(cepDeTexto("88.130-000"), "88130000");
});

test("cepDeTexto recusa texto incompleto ou com dígitos a mais", () => {
  assert.equal(cepDeTexto("8813"), null);
  assert.equal(cepDeTexto("881300001"), null);
  assert.equal(cepDeTexto(""), null);
  assert.equal(cepDeTexto("abc"), null);
});

test("formatarCep põe o hífen conforme se digita", () => {
  assert.equal(formatarCep("88130000"), "88130-000");
  assert.equal(formatarCep("88130"), "88130");
  assert.equal(formatarCep("881300"), "88130-0");
  assert.equal(formatarCep("88130-000999"), "88130-000");
  assert.equal(formatarCep("a8b8"), "88");
});

test("interpretarViaCep devolve endereço, bairro e cidade", () => {
  assert.deepEqual(
    interpretarViaCep({ cep: "88130-000", logradouro: "Rua X", bairro: "Centro", localidade: "Palhoça", uf: "SC" }),
    { endereco: "Rua X", bairro: "Centro", cidade: "Palhoça" }
  );
});

test("interpretarViaCep trata CEP geral (sem rua/bairro) e CEP inexistente", () => {
  assert.deepEqual(interpretarViaCep({ cep: "88300-000", logradouro: "", bairro: "", localidade: "Itajaí", uf: "SC" }), {
    endereco: "",
    bairro: "",
    cidade: "Itajaí",
  });
  assert.equal(interpretarViaCep({ erro: true }), null);
  assert.equal(interpretarViaCep({ erro: "true" }), null);
  assert.equal(interpretarViaCep(null), null);
  assert.equal(interpretarViaCep("lixo"), null);
  assert.equal(interpretarViaCep({}), null);
});
