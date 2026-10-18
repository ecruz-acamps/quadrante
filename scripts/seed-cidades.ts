// Idempotente: cria cidades canônicas, apelidos e vizinhança da Evangelização.
// Uso: npx tsx scripts/seed-cidades.ts
import { PrismaClient } from "@prisma/client";
import { normalizarCidade } from "../src/lib/cidades";

const db = new PrismaClient();

const CIDADES = [
  "Florianópolis", "São José", "Palhoça", "Biguaçu", "Santo Amaro da Imperatriz",
  "Águas Mornas", "Anitápolis", "Rancho Queimado", "Angelina", "Leoberto Leal",
  "Armazém", "Laguna",
];

const APELIDOS_EXTRAS: Record<string, string[]> = {
  "Santo Amaro da Imperatriz": ["santo amaro", "sto amaro", "sto amaro imp", "sto amaro imperatriz", "santo amaro da imp", "sto amaro da imp", "sto amaro da imperatriz", "s amaro da imperatriz", "s amaro da imp"],
  "Florianópolis": ["floripa"],
};

// rascunho — conferir
const VIZINHANCA: [string, string][] = [
  ["Florianópolis", "São José"],
  ["Florianópolis", "Biguaçu"],
  ["São José", "Biguaçu"],
  ["São José", "Palhoça"],
  ["São José", "Santo Amaro da Imperatriz"],
  ["Palhoça", "Santo Amaro da Imperatriz"],
  ["Palhoça", "Águas Mornas"],
  ["Santo Amaro da Imperatriz", "Águas Mornas"],
  ["Santo Amaro da Imperatriz", "Anitápolis"],
  ["Águas Mornas", "Rancho Queimado"],
  ["Águas Mornas", "Anitápolis"],
  ["Anitápolis", "Rancho Queimado"],
  ["Anitápolis", "Angelina"],
  ["Anitápolis", "Leoberto Leal"],
  ["Angelina", "Rancho Queimado"],
  ["Armazém", "Anitápolis"],
  ["Armazém", "Laguna"],
];

async function main() {
  const ids = new Map<string, number>();
  for (const nome of CIDADES) {
    const c = await db.cidade.upsert({ where: { nome }, update: {}, create: { nome } });
    ids.set(nome, c.id);
    const apelidos = new Set([normalizarCidade(nome), ...(APELIDOS_EXTRAS[nome] ?? [])]);
    for (const apelido of apelidos) {
      await db.cidadeApelido.upsert({
        where: { apelido },
        update: {},
        create: { apelido, cidadeId: c.id },
      });
    }
  }
  for (const [a, b] of VIZINHANCA) {
    const ia = ids.get(a)!, ib = ids.get(b)!;
    for (const [x, y] of [[ia, ib], [ib, ia]]) {
      await db.cidadeVizinha.upsert({
        where: { cidadeId_vizinhaId: { cidadeId: x, vizinhaId: y } },
        update: {},
        create: { cidadeId: x, vizinhaId: y },
      });
    }
  }
  console.log("cidades", await db.cidade.count(), "apelidos", await db.cidadeApelido.count(),
    "pares (dois sentidos)", await db.cidadeVizinha.count());

  const mapa = new Map((await db.cidadeApelido.findMany()).map((a) => [a.apelido, a.cidadeId]));
  const contagem = new Map<string, number>();
  const somar = (t: string | null) => {
    if (!t || !t.trim()) return;
    const k = normalizarCidade(t);
    if (!k || mapa.has(k)) return;
    contagem.set(t.trim(), (contagem.get(t.trim()) ?? 0) + 1);
  };
  (await db.pessoa.findMany({ select: { cidade: true } })).forEach((p) => somar(p.cidade));
  (await db.neocampista.findMany({ select: { cidade: true } })).forEach((n) => somar(n.cidade));
  const lista = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  console.log("grafias não reconhecidas:", lista.length);
  console.log(lista.slice(0, 40).map(([t, n]) => `${n}\t${t}`).join("\n"));
}

main().finally(() => db.$disconnect());
