import { test } from "node:test";
import assert from "node:assert/strict";
import { lerAlvoAlerta, tribosProibidasPorLideres } from "./alertasTribo";

test("lerAlvoAlerta: ficha ou líder; número sozinho continua sendo ficha", () => {
  assert.deepEqual(lerAlvoAlerta("ficha:12"), { tipo: "ficha", id: 12 });
  assert.deepEqual(lerAlvoAlerta("lider:7"), { tipo: "lider", id: 7 });
  assert.deepEqual(lerAlvoAlerta("43"), { tipo: "ficha", id: 43 });
  assert.equal(lerAlvoAlerta("lider:0"), null);
  assert.equal(lerAlvoAlerta("servo:7"), null);
  assert.equal(lerAlvoAlerta(""), null);
});

test("tribosProibidasPorLideres: só as tribos lideradas por quem conhece a ficha", () => {
  const lideres = [
    { triboId: 1, servoId: 10 },
    { triboId: 1, servoId: 11 },
    { triboId: 2, servoId: 20 },
    { triboId: 3, servoId: 30 },
  ];
  assert.deepEqual([...tribosProibidasPorLideres([11, 30], lideres)].sort(), [1, 3]);
  assert.deepEqual([...tribosProibidasPorLideres([], lideres)], []);
  assert.deepEqual([...tribosProibidasPorLideres([99], lideres)], []);
});
