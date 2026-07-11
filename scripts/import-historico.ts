/*
 * Importa as 16 missões históricas do arquivo xerere_convertido.xlsx (pasta pai do projeto).
 * Cada aba vira uma Missão com servos (por setor), tribos, campistas (Neocampista) e líderes (TriboLider).
 * Uso: npx tsx scripts/import-historico.ts [/caminho/para/xerere_convertido.xlsx]
 */
import path from "path";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const norm = (v: unknown) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "" || /^x+$/i.test(s) || s === "N/A") return null;
  return s;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ANIV. vem em formatos variados; seriais do Excel viram "dd/mmm", o resto fica como texto cru
function normalizarAniversario(raw: string | null): string | null {
  if (!raw) return null;
  if (/^\d{5}$/.test(raw)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000);
    return `${String(d.getUTCDate()).padStart(2, "0")}/${MESES[d.getUTCMonth()]}`;
  }
  return raw.replace(/\.$/, "");
}

// palavras de função/papel/instrumento que aparecem coladas ao nome — não são parte do nome
const ROLE = /^(coord?\.?|cood|apoio|aux(iliar(es)?)?|voz( e viol[ãa]o)?|teclado|viol[ãa]o|ministra|feminino|masculino|fac|coordenador(a)?|missa fam[íi]lia)$/i;

// remove etiquetas do nome: "Apoio: César", "Coor. Abigail", "Jadna (coord)", "Edson - Apoio"
function limparNome(raw: string): { nome: string; apoio: boolean } {
  let n = raw.trim();
  let apoio = false;
  const doisPontos = n.match(/^([A-Za-zÀ-ú]+):\s*(.+)$/);
  if (doisPontos) {
    apoio = doisPontos[1].toLowerCase() === "apoio";
    n = doisPontos[2].trim();
  }
  const pref = n.match(/^([A-Za-zÀ-ú]+)[.:]{0,2}\s+(.+)$/);
  if (pref && ROLE.test(pref[1])) {
    if (/^apoio$/i.test(pref[1])) apoio = true;
    n = pref[2].trim();
  }
  n = n.replace(/\s*\(([^)]*)\)\s*/g, (m, g) => {
    if (!ROLE.test(g.trim())) return m;
    if (/^apoio$/i.test(g.trim())) apoio = true;
    return " ";
  }).trim();
  n = n.replace(/\s*-\s*(apoio|coord\.?|aux(iliar)?|di[áa]cono)\s*$/i, (m) => {
    if (/apoio/i.test(m)) apoio = true;
    return "";
  }).trim().replace(/\s{2,}/g, " ");
  return { nome: n, apoio };
}

// chave de deduplicação: ignora acentos, caixa e espaços duplicados
const chaveNome = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/\s+/g, " ");

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const file = process.argv[2] || path.resolve(__dirname, "../../xerere_convertido.xlsx");
  console.log("Lendo", file);
  const wb = XLSX.readFile(file);

  // cache de pessoas por nome normalizado (inclui as já existentes no banco)
  const pessoaCache = new Map<string, number>();
  for (const p of await db.pessoa.findMany({ select: { id: true, nome: true } })) {
    pessoaCache.set(chaveNome(p.nome), p.id);
  }

  async function getOrCreatePessoa(data: {
    nome: string;
    celular?: string | null;
    endereco?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    email?: string | null;
    aniversario?: string | null;
  }) {
    const key = chaveNome(data.nome);
    const existenteId = pessoaCache.get(key);
    if (existenteId) {
      // só completa campos vazios, nunca sobrescreve dado já cadastrado
      const p = await db.pessoa.findUnique({ where: { id: existenteId } });
      if (p) {
        const preencher: Record<string, string> = {};
        for (const campo of ["celular", "endereco", "bairro", "cidade", "email", "aniversario"] as const) {
          const novo = data[campo];
          if (novo && !p[campo]) preencher[campo] = novo;
        }
        if (Object.keys(preencher).length) {
          await db.pessoa.update({ where: { id: existenteId }, data: preencher });
        }
      }
      return existenteId;
    }
    const pessoa = await db.pessoa.create({ data });
    pessoaCache.set(key, pessoa.id);
    return pessoa.id;
  }

  const reAba = /^(\d+)[º°o]?\s+(FAC|Senior)\s+(.+)$/i;

  for (const abaNome of wb.SheetNames) {
    const m = abaNome.match(reAba);
    if (!m) {
      console.warn("Aba ignorada (nome não reconhecido):", abaNome);
      continue;
    }
    const ordinal = Number(m[1]);
    const tipo = m[2].toUpperCase();
    const cidade = m[3].trim();
    const cercoSlug = `hist-${tipo.toLowerCase()}-${ordinal}-${slugify(cidade)}`;

    const missao = await db.missao.upsert({
      where: { cercoSlug },
      update: { nome: abaNome, tipo, ano: ordinal },
      create: { nome: abaNome, tipo, ano: ordinal, cercoSlug },
    });

    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[abaNome], { header: 1, defval: null });
    let servos = 0, campistas = 0, lideres = 0;
    let secaoAtual: string | null = null;
    let triboAtualId: number | null = null;
    let triboAtualNome: string | null = null;
    let proximaFicha = 1;
    const triboPorCor = new Map<string, number>(); // cor normalizada -> tribo id (p/ líderes)

    for (const row of rows.slice(1)) {
      const col0 = norm(row?.[0]);
      if (!col0 || col0 === "NOME") continue;

      // linha de seção: só a coluna 0 preenchida
      if (row.slice(1).every((c: unknown) => norm(c) === null)) {
        secaoAtual = col0;
        triboAtualId = null;
        const t = col0.match(/^TRIBO\s+([A-ZÀ-Úa-zà-ú]+)/);
        if (t) {
          const cor = t[1];
          // nomes canônicos da app são femininos (TRIBO AMARELA), planilhas variam (AMARELO/AMARELA)
          const CANON: Record<string, string> = { AMARELO: "AMARELA", PRETO: "PRETA", ROXO: "ROXA", VERMELHO: "VERMELHA" };
          const corUp = cor.toUpperCase();
          triboAtualNome = `TRIBO ${CANON[corUp] || corUp}`;
          const tribo = await db.tribo.upsert({
            where: { missaoId_nome: { missaoId: missao.id, nome: triboAtualNome } },
            update: { cor },
            create: { missaoId: missao.id, nome: triboAtualNome, cor },
          });
          triboAtualId = tribo.id;
          // cores femininas/masculinas variam entre abas (Amarela/Amarelo) — indexa pela raiz
          triboPorCor.set(cor.toUpperCase().replace(/[AO]$/, ""), tribo.id);
        }
        continue;
      }

      const setor = norm(row[8]);
      if (!setor) continue;
      const bruto = limparNome(col0);
      const dados = {
        nome: bruto.nome,
        endereco: norm(row[1]),
        bairro: norm(row[2]),
        cidade: norm(row[3]),
        celular: norm(row[5]) || norm(row[4]), // FONE fixo como fallback
        email: norm(row[6]),
        aniversario: normalizarAniversario(norm(row[7])),
      };

      if (setor === "CAMPISTA") {
        await db.neocampista.upsert({
          where: { missaoId_numero: { missaoId: missao.id, numero: proximaFicha } },
          update: {
            nome: dados.nome, nucleo: "SEM NÚCLEO", endereco: dados.endereco, bairro: dados.bairro,
            cidade: dados.cidade, celular: dados.celular, triboId: triboAtualId,
          },
          create: {
            missaoId: missao.id, numero: proximaFicha, nome: dados.nome, nucleo: "SEM NÚCLEO",
            endereco: dados.endereco, bairro: dados.bairro, cidade: dados.cidade,
            celular: dados.celular, triboId: triboAtualId,
          },
        });
        proximaFicha++;
        campistas++;
        continue;
      }

      const pessoaId = await getOrCreatePessoa(dados);
      const funcao = bruto.apoio ? "APOIO" : norm(row[9]) || "INTEGRANTE";
      const servo = await db.servo.upsert({
        where: { missaoId_pessoaId: { missaoId: missao.id, pessoaId } },
        update: { setor, funcao },
        create: { missaoId: missao.id, pessoaId, setor, funcao },
      });
      servos++;

      // servo com cor de tribo (seções LÍDER, ANJO...) -> TriboLider; tribos são criadas depois na aba, resolve em 2ª passada
      const corLider = norm(row[10]);
      if (corLider) {
        lideresPendentes.push({ servoId: servo.id, cor: corLider.toUpperCase().replace(/[AO]$/, ""), missaoId: missao.id });
      }
    }

    // resolve líderes agora que as tribos da missão existem
    for (const l of lideresPendentes.filter((l) => l.missaoId === missao.id)) {
      const triboId = triboPorCor.get(l.cor);
      if (!triboId) continue;
      await db.triboLider.upsert({
        where: { triboId_servoId: { triboId, servoId: l.servoId } },
        update: {},
        create: { triboId, servoId: l.servoId },
      });
      lideres++;
    }

    console.log(`${abaNome}: ${servos} servos, ${campistas} campistas, ${lideres} líderes de tribo`);
  }

  console.log("Importação concluída.");
}

const lideresPendentes: { servoId: number; cor: string; missaoId: number }[] = [];

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
