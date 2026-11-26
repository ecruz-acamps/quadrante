import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoNucleos } from "./controleNucleos";

test("resumoNucleos: faltam = recebidas - cadastradas; a mais quando passa; núcleo antigo entra no fim", () => {
  const { linhas, total } = resumoNucleos(
    new Map([["ANGELINA", 10], ["AGUAS MORNAS", 5]]),
    new Map([["ANGELINA", 7], ["AGUAS MORNAS", 6], ["Núcleo Antigo", 2]]),
  );
  const ang = linhas.find((l) => l.nucleo === "ANGELINA")!;
  assert.deepEqual([ang.recebidas, ang.cadastradas, ang.faltam, ang.aMais], [10, 7, 3, 0]);
  const ag = linhas.find((l) => l.nucleo === "AGUAS MORNAS")!;
  assert.deepEqual([ag.faltam, ag.aMais], [0, 1]);
  assert.equal(linhas[0].nucleo, "AGUAS MORNAS"); // ordem da lista oficial
  assert.equal(linhas.at(-1)!.nucleo, "Núcleo Antigo");
  assert.equal(linhas.at(-1)!.foraDaLista, true);
  assert.equal(linhas.length, 17); // 16 da lista + 1 antigo
  assert.deepEqual(total, { recebidas: 15, cadastradas: 15, faltam: 3, aMais: 3 });
});
