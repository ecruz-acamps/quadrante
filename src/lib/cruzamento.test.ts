import { test } from "node:test";
import assert from "node:assert/strict";
import { cruzar, filtrar, normNome, type Campista, type ServoReg } from "./cruzamento";

const camp = (id: number, nome: string, celular: string | null = null): Campista => ({ id, numero: id, nome, celular, nucleo: "N", cidade: null });
const servo = (nome: string, missaoId: number, status = "ATIVO", celular: string | null = null): ServoReg => ({
  nome, celular, missaoId, missaoNome: `M${missaoId}`, status, setor: "CAPELA", funcao: "INTEGRANTE", confirmado: false,
});

test("normNome ignora acento, caixa e pontuação", () => {
  assert.equal(normNome("  João  D'Ávila "), "joao d avila");
});

test("casa pelo nome e separa quem está no alvo, em outra missão e quem nunca serviu", () => {
  const linhas = cruzar(
    [camp(1, "João Silva"), camp(2, "Maria Souza"), camp(3, "Pedro Lima")],
    [servo("Joao silva", 24), servo("MARIA SOUZA", 20), servo("Pedro Lima", 20, "RECUSOU")],
    24
  );
  assert.equal(linhas[0].noAlvo?.missaoId, 24);
  assert.equal(linhas[1].outrasMissoes.length, 1);
  assert.equal(linhas[1].nuncaServiu, false);
  assert.equal(linhas[2].nuncaServiu, true);
  assert.equal(linhas[2].recusouAntes, true);
  assert.deepEqual(filtrar(linhas, "nunca").map((l) => l.campista.id), [3]);
  assert.deepEqual(filtrar(linhas, "serviram").map((l) => l.campista.id), [1]);
  assert.deepEqual(filtrar(linhas, "fora").map((l) => l.campista.id), [2, 3]);
});

test("mesmo celular de outro servo do alvo vira aviso, não casamento", () => {
  const [l] = cruzar([camp(1, "Itamar Cargnin", "48 99999-1111")], [servo("Maria Cargnin", 24, "ATIVO", "(48) 99999-1111")], 24);
  assert.equal(l.noAlvo, null);
  assert.equal(l.avisoTelefone, "Maria Cargnin");
});

test("primeiro e último nome iguais com meio diferente vira aviso de parecido", () => {
  const [l] = cruzar([camp(1, "Rosalia Alzira da Rosa")], [servo("Rosalia Vieira da Rosa", 24)], 24);
  assert.equal(l.noAlvo, null);
  assert.equal(l.avisoParecido, "Rosalia Vieira da Rosa");
});
