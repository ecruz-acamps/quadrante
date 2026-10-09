import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarBancoTemporario } from "./testdb";

const banco = criarBancoTemporario();
process.env.DATABASE_URL = banco.url;

type Db = typeof import("./db").db;
let db: Db;
let m: typeof import("./cercoReserva");
let missaoA: number;
let missaoB: number;

async function novoServo(missaoId: number, nome: string, status = "ATIVO") {
  const p = await db.pessoa.create({ data: { nome } });
  return (await db.servo.create({ data: { missaoId, pessoaId: p.id, setor: "TROPA", status } })).id;
}
const horarioDe = async (servoId: number) => (await db.servo.findUnique({ where: { id: servoId } }))?.cercoHorario;
const ocupacao = (missaoId: number, h: string) =>
  db.servo.count({ where: { missaoId, status: "ATIVO", cercoHorario: h } });

before(async () => {
  db = (await import("./db")).db;
  m = await import("./cercoReserva");
  const mk = (slug: string) => db.missao.create({ data: { nome: slug, tipo: "SENIOR", ano: 1, cercoSlug: slug } });
  missaoA = (await mk("a")).id;
  missaoB = (await mk("b")).id;
});
after(async () => {
  await db?.$disconnect();
  banco.limpar();
});

test("reserva até o limite e recusa a partir dele", async () => {
  const [s1, s2, s3] = [await novoServo(missaoA, "Um"), await novoServo(missaoA, "Dois"), await novoServo(missaoA, "Tres")];
  assert.equal(await m.reservarHorarioCerco(db, { servoId: s1, missaoId: missaoA, horario: "01:00 - 02:00", max: 2 }), true);
  assert.equal(await m.reservarHorarioCerco(db, { servoId: s2, missaoId: missaoA, horario: "01:00 - 02:00", max: 2 }), true);
  assert.equal(await m.reservarHorarioCerco(db, { servoId: s3, missaoId: missaoA, horario: "01:00 - 02:00", max: 2 }), false);
  assert.equal(await horarioDe(s3), null, "o servo recusado não pode ficar com o horário");
  assert.equal(await ocupacao(missaoA, "01:00 - 02:00"), 2);
});

test("corrida: 12 pessoas disputando 3 vagas ao mesmo tempo nunca passam do limite", async () => {
  const ids: number[] = [];
  for (let i = 0; i < 12; i++) ids.push(await novoServo(missaoA, `Corredor ${i}`));
  const resultados = await Promise.allSettled(
    ids.map((servoId) => m.reservarHorarioCerco(db, { servoId, missaoId: missaoA, horario: "05:00 - 06:00", max: 3 })),
  );
  const ganhou = resultados.filter((r) => r.status === "fulfilled" && r.value === true).length;
  assert.ok(ganhou <= 3, `ganharam ${ganhou} vagas de 3`);
  assert.equal(await ocupacao(missaoA, "05:00 - 06:00"), ganhou, "o banco confere com quem ganhou");
  assert.ok(ganhou >= 1, "alguém precisa conseguir");
});

test("quem já está no horário pode confirmá-lo de novo sem se contar duas vezes", async () => {
  const s = await novoServo(missaoA, "Repetido");
  assert.equal(await m.reservarHorarioCerco(db, { servoId: s, missaoId: missaoA, horario: "10:00 - 11:00", max: 1 }), true);
  assert.equal(await m.reservarHorarioCerco(db, { servoId: s, missaoId: missaoA, horario: "10:00 - 11:00", max: 1 }), true);
  assert.equal(await ocupacao(missaoA, "10:00 - 11:00"), 1);
});

test("trocar de horário libera o anterior", async () => {
  const s = await novoServo(missaoA, "Trocador");
  await m.reservarHorarioCerco(db, { servoId: s, missaoId: missaoA, horario: "12:00 - 13:00", max: 5 });
  await m.reservarHorarioCerco(db, { servoId: s, missaoId: missaoA, horario: "13:00 - 14:00", max: 5 });
  assert.equal(await horarioDe(s), "13:00 - 14:00");
  assert.equal(await ocupacao(missaoA, "12:00 - 13:00"), 0);
});

test("a lotação é por missão e só conta servos ATIVOS", async () => {
  const b = await novoServo(missaoB, "De outra missão");
  assert.equal(await m.reservarHorarioCerco(db, { servoId: b, missaoId: missaoB, horario: "01:00 - 02:00", max: 1 }), true);
  const desistente = await novoServo(missaoA, "Desistente", "DESISTIU");
  await db.servo.update({ where: { id: desistente }, data: { cercoHorario: "20:00 - 21:00" } });
  const ativo = await novoServo(missaoA, "Ativo");
  assert.equal(await m.reservarHorarioCerco(db, { servoId: ativo, missaoId: missaoA, horario: "20:00 - 21:00", max: 1 }), true);
});

test("servo de outra missão ou inexistente nunca é alterado", async () => {
  const s = await novoServo(missaoA, "Da A");
  assert.equal(await m.reservarHorarioCerco(db, { servoId: s, missaoId: missaoB, horario: "07:00 - 08:00", max: 9 }), false);
  assert.equal(await m.reservarHorarioCerco(db, { servoId: 99999999, missaoId: missaoA, horario: "07:00 - 08:00", max: 9 }), false);
  assert.equal(await horarioDe(s), null);
});

test("limite inválido (0, negativo, decimal) recusa em vez de liberar tudo", async () => {
  const s = await novoServo(missaoA, "Limite ruim");
  for (const max of [0, -1, 2.5, NaN]) {
    assert.equal(await m.reservarHorarioCerco(db, { servoId: s, missaoId: missaoA, horario: "15:00 - 16:00", max }), false, `max=${max}`);
  }
  assert.equal(await horarioDe(s), null);
});
