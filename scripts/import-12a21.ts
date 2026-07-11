/*
 * Importa as missões 12º a 21º Sênior do arquivo acampamentos_12_a_21_convertido.xlsx (pasta pai).
 * Colunas: NOME | ENDEREÇO | BAIRRO | CIDADE | FONE | CELULAR | CAMISETA | SETOR | FUNÇÃO | TRIBO | FICHA | OBSERVAÇÕES
 * Decisões do usuário (2026-07-08):
 *  - Aba 13: as 147 pessoas em "LÍDERES SEM TRIBO DEFINIDA" entram como CAMPISTAS sem tribo.
 *  - Abas 14/15 não têm campistas no arquivo: importar assim mesmo (só servos/líderes).
 * Uso: npx tsx scripts/import-12a21.ts [/caminho/para/acampamentos_12_a_21_convertido.xlsx]
 */
import path from "path";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { normalizarNome } from "../src/lib/nomes";

const db = new PrismaClient();

const norm = (v: unknown) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "" || /^x+$/i.test(s) || s === "N/A" || s === "---X---") return null;
  return s;
};

// linhas que não são pessoas (títulos que vazaram para a coluna NOME)
const LIXO = /ACAMPAMENTO\s+S[ÊE]NIOR|EQUIPE\s+DE\s+TRABALHO|^EQUIPE\s+INTERNA$|^32wedx$/i;

const CANON: Record<string, string> = { AMARELO: "AMARELA", PRETO: "PRETA", ROXO: "ROXA", VERMELHO: "VERMELHA", MARRON: "MARROM" };
const corCanonica = (cor: string) => `TRIBO ${CANON[cor.toUpperCase()] || cor.toUpperCase()}`;
const raizCor = (cor: string) => cor.toUpperCase().replace(/[AO]$/, "");

const chaveNome = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/\s+/g, " ");

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const file = process.argv[2] || path.resolve(__dirname, "../../acampamentos_12_a_21_convertido.xlsx");
  console.log("Lendo", file);
  const wb = XLSX.readFile(file);

  const pessoaCache = new Map<string, number>();
  for (const p of await db.pessoa.findMany({ select: { id: true, nome: true } })) {
    pessoaCache.set(chaveNome(p.nome), p.id);
  }

  async function getOrCreatePessoa(data: {
    nome: string; celular?: string | null; endereco?: string | null;
    bairro?: string | null; cidade?: string | null;
  }) {
    const key = chaveNome(data.nome);
    const existenteId = pessoaCache.get(key);
    if (existenteId) {
      const p = await db.pessoa.findUnique({ where: { id: existenteId } });
      if (p) {
        const preencher: Record<string, string> = {};
        for (const campo of ["celular", "endereco", "bairro", "cidade"] as const) {
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

  const reAba = /^(\d+)[º°]\s+S[êe]nior(?:\s*-\s*(.+))?$/i;

  for (const abaNome of wb.SheetNames) {
    const m = abaNome.match(reAba);
    if (!m) {
      console.warn("Aba ignorada (nome não reconhecido):", abaNome);
      continue;
    }
    const ordinal = Number(m[1]);
    const sufixo = m[2] ? `-${slugify(m[2])}` : "";
    const cercoSlug = `hist-senior-${ordinal}${sufixo}`;

    const missao = await db.missao.upsert({
      where: { cercoSlug },
      update: { nome: abaNome, tipo: "SENIOR", ano: ordinal },
      create: { nome: abaNome, tipo: "SENIOR", ano: ordinal, cercoSlug },
    });

    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[abaNome], { header: 1, defval: null });
    let servos = 0, campistas = 0, lideres = 0, ignoradas = 0;
    let secaoAtual: string | null = null;
    let secaoLiderCor: string | null = null;
    let triboAtualId: number | null = null;
    let proximaFicha = 1; // fallback quando a coluna FICHA está vazia
    const fichasUsadas = new Set<number>();
    const triboPorRaiz = new Map<string, number>();
    const lideresPendentes: { servoId: number; cor: string }[] = [];

    async function upsertTribo(cor: string) {
      const nome = corCanonica(cor);
      const tribo = await db.tribo.upsert({
        where: { missaoId_nome: { missaoId: missao.id, nome } },
        update: {},
        create: { missaoId: missao.id, nome, cor },
      });
      triboPorRaiz.set(raizCor(cor), tribo.id);
      return tribo.id;
    }

    for (const row of rows.slice(1)) {
      const col0 = norm(row?.[0]);
      if (!col0 || col0 === "NOME") continue;

      // linha de seção: só a coluna 0 preenchida
      if (row.slice(1).every((c: unknown) => norm(c) === null)) {
        secaoAtual = col0;
        triboAtualId = null;
        secaoLiderCor = null;
        const t = col0.match(/^TRIBO\s+([A-ZÀ-Úa-zà-ú]+)/);
        // "TRIBO SEM TRIBO - n CAMPISTAS" = campistas sem tribo, não é uma cor
        if (t && t[1].toUpperCase() !== "SEM") triboAtualId = await upsertTribo(t[1]);
        // em algumas abas a coluna TRIBO dos líderes vem vazia; a cor está no cabeçalho da seção
        const tl = col0.match(/^L[ÍI]DERES\s+TRIBO\s+([A-ZÀ-Úa-zà-ú]+)/i);
        if (tl) secaoLiderCor = tl[1];
        continue;
      }

      const setor = norm(row[7]);
      if (!setor || setor === "SETOR") continue;
      if (LIXO.test(col0)) { ignoradas++; console.log(`  [ignorada] ${abaNome}: "${col0}"`); continue; }

      const nome = normalizarNome(col0);
      const dados = {
        endereco: norm(row[1]),
        bairro: norm(row[2]),
        cidade: norm(row[3]),
        celular: norm(row[5]) || norm(row[4]),
      };
      const camiseta = norm(row[6]);
      const obs = norm(row[11]);

      // decisão do usuário: na aba 13, "LÍDERES SEM TRIBO DEFINIDA" são campistas sem tribo
      const campistaSemTribo13 =
        ordinal === 13 && setor === "LÍDER" && /^L[ÍI]DERES SEM TRIBO/i.test(secaoAtual || "");

      if (setor === "CAMPISTA" || campistaSemTribo13) {
        const fichaCol = norm(row[10]);
        let numero = fichaCol && /^\d+$/.test(fichaCol) ? Number(fichaCol) : NaN;
        if (!Number.isFinite(numero) || fichasUsadas.has(numero)) {
          while (fichasUsadas.has(proximaFicha)) proximaFicha++;
          numero = proximaFicha;
        }
        fichasUsadas.add(numero);
        const nucleoMatch = obs?.match(/N[ÚU]CLEO\s+([^;]+)/i);
        const nucleo = nucleoMatch ? `NÚCLEO ${nucleoMatch[1].trim()}` : "SEM NÚCLEO";
        const dadosFicha = {
          nome, nucleo, endereco: dados.endereco, bairro: dados.bairro, cidade: dados.cidade,
          celular: dados.celular, camiseta, observacao: obs,
          triboId: campistaSemTribo13 ? null : triboAtualId,
        };
        await db.neocampista.upsert({
          where: { missaoId_numero: { missaoId: missao.id, numero } },
          update: dadosFicha,
          create: { missaoId: missao.id, numero, ...dadosFicha },
        });
        campistas++;
        continue;
      }

      const pessoaId = await getOrCreatePessoa({ nome, ...dados });
      const funcao = norm(row[8]) || "INTEGRANTE";
      const servo = await db.servo.upsert({
        where: { missaoId_pessoaId: { missaoId: missao.id, pessoaId } },
        update: { setor, funcao, camiseta },
        create: { missaoId: missao.id, pessoaId, setor, funcao, camiseta },
      });
      servos++;

      const corLider = norm(row[9]) || (setor === "LÍDER" ? secaoLiderCor : null);
      if (corLider) lideresPendentes.push({ servoId: servo.id, cor: corLider });
    }

    // resolve líderes; cria a tribo se a aba não tiver seção de campistas daquela cor (13/14/15)
    for (const l of lideresPendentes) {
      let triboId = triboPorRaiz.get(raizCor(l.cor));
      if (!triboId) triboId = await upsertTribo(l.cor);
      await db.triboLider.upsert({
        where: { triboId_servoId: { triboId, servoId: l.servoId } },
        update: {},
        create: { triboId, servoId: l.servoId },
      });
      lideres++;
    }

    console.log(`${abaNome}: ${servos} servos, ${campistas} campistas, ${lideres} líderes de tribo, ${ignoradas} linhas ignoradas`);
  }

  console.log("Importação concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
