/*
 * Importa o arquivo "22° Acampamento Sênior.xlsx" (pasta pai do projeto) para o banco.
 * Uso: npx tsx scripts/import-excel.ts "/caminho/para/arquivo.xlsx" "Nome da missão" SENIOR 22 cercosenior22
 */
import path from "path";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const HORARIOS_CANONICOS = Array.from({ length: 24 }, (_, h) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:00 - ${p((h + 1) % 24)}:00`;
});

// corrige erros de digitação da planilha original (ex: "15:00 - 16:01" -> "15:00 - 16:00")
function normalizarHorario(raw: string): string {
  if (HORARIOS_CANONICOS.includes(raw)) return raw;
  const m = raw.match(/(\d{1,2}):/);
  if (m) {
    const h = Number(m[1]) % 24;
    if (HORARIOS_CANONICOS[h]) return HORARIOS_CANONICOS[h];
  }
  return raw;
}

const norm = (v: unknown) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" || s === "N/A" ? null : s;
};
// remove prefixo de função/observação colado no nome (ex.: "Coord: Fulano", "Cood.:Ciclana", "Rep. Cood. Geral:Beltrana")
// a função já vem em coluna própria; nomes reais não têm ":", então tudo antes do primeiro ":" é lixo de digitação
const PREFIXO_FUNCAO = /^.*?:\s*/;
const normNome = (v: unknown) => {
  const s = norm(v);
  return s === null ? null : s.replace(PREFIXO_FUNCAO, "");
};
const numOrNull = (v: unknown) => {
  const s = norm(v);
  if (s === null) return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const file = process.argv[2] || path.resolve(__dirname, "../../22° Acampamento Sênior.xlsx");
  const nome = process.argv[3] || "22° Acampamento Sênior";
  const tipo = process.argv[4] || "SENIOR";
  const ano = Number(process.argv[5] || 22);
  const cercoSlug = process.argv[6] || "cercosenior22";

  console.log("Lendo", file);
  const wb = XLSX.readFile(file);
  const sheet = (name: string) => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, defval: null });

  const missao = await db.missao.upsert({
    where: { cercoSlug },
    update: { nome, tipo, ano },
    create: { nome, tipo, ano, cercoSlug },
  });
  console.log("Missão:", missao.nome, "id=", missao.id);

  // ---------- domínios: aba "Base de Dados" ----------
  const base = sheet("Base de Dados");
  const baseHeader = base[0] as any[];
  const colIndex = (label: string) => baseHeader.findIndex((h) => h === label);
  const setoresCol = colIndex("SETORES");
  const nucleosCol = colIndex("NÚCLEOS");

  const setores = new Set<string>();
  const nucleos = new Set<string>();
  for (const row of base.slice(1)) {
    const s = norm(row[setoresCol]);
    if (s) setores.add(s);
    const n = norm(row[nucleosCol]);
    if (n) nucleos.add(n);
  }
  for (const s of setores) {
    await db.setor.upsert({ where: { nome: s }, update: {}, create: { nome: s } });
  }
  for (const n of nucleos) {
    await db.nucleo.upsert({ where: { nome: n }, update: {}, create: { nome: n } });
  }
  console.log("Setores:", setores.size, "Núcleos:", nucleos.size);

  // ---------- Procv: cidade+bairro -> paróquia ----------
  const procv = sheet("Procv");
  for (const row of procv.slice(1)) {
    const cidade = norm(row[0]);
    const bairro = norm(row[1]);
    const paroquia = norm(row[3]);
    if (!cidade || !bairro || !paroquia) continue;
    await db.paroquia.upsert({
      where: { cidade_bairro: { cidade, bairro } },
      update: { paroquia },
      create: { cidade, bairro, paroquia },
    });
  }
  console.log("Paróquias (Procv) importadas.");

  // ---------- Pessoa/Servo helper ----------
  const pessoaCache = new Map<string, number>();
  async function getOrCreatePessoa(data: {
    nome: string;
    cpf?: string | null;
    celular?: string | null;
    endereco?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    paroquia?: string | null;
    sexo?: string | null;
    camiseta?: string | null;
  }) {
    const key = (data.cpf || data.nome).toUpperCase();
    if (pessoaCache.has(key)) return pessoaCache.get(key)!;
    let pessoa = data.cpf ? await db.pessoa.findFirst({ where: { cpf: data.cpf } }) : null;
    if (!pessoa) pessoa = await db.pessoa.findFirst({ where: { nome: data.nome } });
    if (!pessoa) {
      pessoa = await db.pessoa.create({ data });
    }
    pessoaCache.set(key, pessoa.id);
    return pessoa.id;
  }

  // ---------- aba 1: Quadrante de Servos ----------
  const quadrante = sheet("Quadrante de Servos");
  // header está na linha (index) que contém 'NOME'
  const headerRowIdx = quadrante.findIndex((r) => r?.[0] === "NOME");
  const H = quadrante[headerRowIdx] as any[];
  const idx = (label: string) => H.findIndex((h) => h === label);
  const cNome = idx("NOME"),
    cEnd = idx("ENDEREÇO"),
    cBairro = idx("BAIRRO"),
    cCidade = idx("CIDADE"),
    cCel = idx("CELULAR"),
    cSetor = idx("SETOR"),
    cFuncao = idx("FUNÇÃO"),
    cCamiseta = idx("CAMISETA"),
    cCerco = idx("CERCO"),
    cF1 = idx("1° FORMAÇÃO"),
    cF2 = idx("2° FORMAÇÃO"),
    cF3 = idx("3° FORMAÇÃO"),
    cPag = idx("PAGAMENTO"),
    cObs = idx("OBSERVAÇÕES"),
    cParoquia = idx("PARÓQUIA"),
    cCpf = idx("CPF");

  let servosImportados = 0;
  let currentSetorFromHeader: string | null = null;
  for (const row of quadrante.slice(headerRowIdx + 1)) {
    if (!row || row.every((c) => c === null)) continue;
    const nome = normNome(row[cNome]);
    if (!nome) continue;
    // linhas de cabeçalho de setor tipo "SECRETARIA - 2 COORDENADORES..." só têm coluna 0 preenchida
    if (row.slice(1).every((c) => c === null)) {
      continue; // linha de título de setor, ignorada — usamos a coluna SETOR de cada linha de servo
    }
    const setor = norm(row[cSetor]);
    if (!setor) continue;

    const pessoaId = await getOrCreatePessoa({
      nome,
      cpf: norm(row[cCpf]),
      celular: norm(row[cCel]),
      endereco: norm(row[cEnd]),
      bairro: norm(row[cBairro]),
      cidade: norm(row[cCidade]),
      paroquia: norm(row[cParoquia]),
      camiseta: norm(row[cCamiseta]),
    });

    const cercoRaw = norm(row[cCerco]);
    const cercoHorario = cercoRaw && cercoRaw !== "NÃO TEM" ? normalizarHorario(cercoRaw) : null;

    await db.servo.upsert({
      where: { missaoId_pessoaId: { missaoId: missao.id, pessoaId } },
      update: {
        setor,
        funcao: norm(row[cFuncao]) || "INTEGRANTE",
        camiseta: norm(row[cCamiseta]),
        formacao1: norm(row[cF1]),
        formacao2: norm(row[cF2]),
        formacao3: norm(row[cF3]),
        pagamentoForma: norm(row[cPag]),
        pago: !!norm(row[cPag]),
        observacoes: norm(row[cObs]),
        cercoHorario,
      },
      create: {
        missaoId: missao.id,
        pessoaId,
        setor,
        funcao: norm(row[cFuncao]) || "INTEGRANTE",
        camiseta: norm(row[cCamiseta]),
        formacao1: norm(row[cF1]),
        formacao2: norm(row[cF2]),
        formacao3: norm(row[cF3]),
        pagamentoForma: norm(row[cPag]),
        pago: !!norm(row[cPag]),
        observacoes: norm(row[cObs]),
        cercoHorario,
      },
    });
    servosImportados++;
  }
  console.log("Servos importados:", servosImportados);

  // ---------- aba 3: Falaram NÃO ----------
  const falaramNao = sheet("Falaram NÃO");
  const hNaoIdx = falaramNao.findIndex((r) => r?.[0] === "NOME" || r?.[1] === "NOME" || r?.[1] === "SERVO");
  if (hNaoIdx >= 0) {
    const HN = falaramNao[hNaoIdx] as any[];
    const iNome = HN.findIndex((h) => h === "NOME" || h === "SERVO");
    const iSetor = HN.findIndex((h) => h === "SETOR");
    const iCel = HN.findIndex((h) => h === "CELULAR");
    let count = 0;
    for (const row of falaramNao.slice(hNaoIdx + 1)) {
      const nome = normNome(row?.[iNome]);
      if (!nome) continue;
      const pessoaId = await getOrCreatePessoa({ nome, celular: iCel >= 0 ? norm(row[iCel]) : null });
      await db.servo.upsert({
        where: { missaoId_pessoaId: { missaoId: missao.id, pessoaId } },
        update: { status: "RECUSOU", setor: (iSetor >= 0 && norm(row[iSetor])) || "NÃO INFORMADO" },
        create: {
          missaoId: missao.id,
          pessoaId,
          status: "RECUSOU",
          setor: (iSetor >= 0 && norm(row[iSetor])) || "NÃO INFORMADO",
        },
      });
      count++;
    }
    console.log("Falaram NÃO importados:", count);
  }

  // ---------- aba 7: Desistiram ----------
  const desistiram = sheet("Ñ part. FormaçãoDesistiram");
  const hDesIdx = desistiram.findIndex((r) => r?.[1] === "NOME");
  if (hDesIdx >= 0) {
    const HD = desistiram[hDesIdx] as any[];
    const iNome = HD.findIndex((h) => h === "NOME");
    const iSetor = HD.findIndex((h) => h === "SETOR");
    const iCel = HD.findIndex((h) => h === "CELULAR");
    let count = 0;
    for (const row of desistiram.slice(hDesIdx + 1)) {
      const nome = normNome(row?.[iNome]);
      if (!nome) continue;
      const pessoaId = await getOrCreatePessoa({ nome, celular: iCel >= 0 ? norm(row[iCel]) : null });
      await db.servo.upsert({
        where: { missaoId_pessoaId: { missaoId: missao.id, pessoaId } },
        update: { status: "DESISTIU", setor: (iSetor >= 0 && norm(row[iSetor])) || "NÃO INFORMADO" },
        create: {
          missaoId: missao.id,
          pessoaId,
          status: "DESISTIU",
          setor: (iSetor >= 0 && norm(row[iSetor])) || "NÃO INFORMADO",
        },
      });
      count++;
    }
    console.log("Desistiram importados:", count);
  }

  // ---------- aba 5: Faltantes Formação (motivo) ----------
  const faltantes = sheet("Faltantes Formação");
  const hFaltIdx = faltantes.findIndex((r) => r?.[1] === "SERVO");
  if (hFaltIdx >= 0) {
    const HF = faltantes[hFaltIdx] as any[];
    const iNome = HF.findIndex((h) => h === "SERVO");
    let count = 0;
    for (const row of faltantes.slice(hFaltIdx + 1)) {
      const nome = norm(row?.[iNome]);
      if (!nome) continue;
      const pessoa = await db.pessoa.findFirst({ where: { nome } });
      if (!pessoa) continue;
      const servo = await db.servo.findUnique({ where: { missaoId_pessoaId: { missaoId: missao.id, pessoaId: pessoa.id } } });
      if (!servo) continue;
      await db.servo.update({ where: { id: servo.id }, data: { motivoFalta: "Faltou em ao menos uma formação (ver planilha original)" } });
      count++;
    }
    console.log("Faltantes formação marcados:", count);
  }

  // ---------- aba 8: Fichas Numeradas (neocampistas) ----------
  const fichas = sheet("Fichas Numeradas");
  const hFichaIdx = fichas.findIndex((r) => r?.[2] === "NOME");
  if (hFichaIdx >= 0) {
    const HFi = fichas[hFichaIdx] as any[];
    const fi = (label: string) => HFi.findIndex((h) => h === label);
    const iNum = 0,
      iNucleo = fi("NÚCLEO"),
      iNome = fi("NOME"),
      iEnd = fi("ENDEREÇO"),
      iBairro = fi("BAIRRO"),
      iCidade = fi("CIDADE"),
      iCel = fi("CELULAR"),
      iIdade = fi("IDADE"),
      iAltura = fi("ALTURA"),
      iPeso = fi("PESO"),
      iSexo = fi("SEXO"),
      iCamiseta = fi("CAMISETA"),
      iPag = fi("PAGAMENTO"),
      iObs = fi("OBSERVAÇÃO"),
      iCpf = fi("CPF"),
      alertaCols = [fi("F1"), fi("F2"), fi("F3"), fi("F4"), fi("F5"), fi("F6"), fi("F7"), fi("F8")].filter((c) => c >= 0);

    const numeroToId = new Map<number, number>();
    let count = 0;
    for (const row of fichas.slice(hFichaIdx + 1)) {
      const numero = numOrNull(row?.[iNum]);
      const nome = norm(row?.[iNome]);
      if (!numero || !nome) continue;
      const created = await db.neocampista.upsert({
        where: { missaoId_numero: { missaoId: missao.id, numero: Math.round(numero) } },
        update: {
          nucleo: norm(row[iNucleo]) || "SEM NÚCLEO",
          nome,
          endereco: norm(row[iEnd]),
          bairro: norm(row[iBairro]),
          cidade: norm(row[iCidade]),
          celular: norm(row[iCel]),
          idade: iIdade >= 0 && numOrNull(row[iIdade]) ? Math.round(numOrNull(row[iIdade])!) : null,
          altura: iAltura >= 0 ? numOrNull(row[iAltura]) : null,
          peso: iPeso >= 0 ? numOrNull(row[iPeso]) : null,
          sexo: norm(row[iSexo]),
          camiseta: norm(row[iCamiseta]),
          pagamento: norm(row[iPag]),
          observacao: norm(row[iObs]),
          cpf: iCpf >= 0 ? norm(row[iCpf]) : null,
        },
        create: {
          missaoId: missao.id,
          numero: Math.round(numero),
          nucleo: norm(row[iNucleo]) || "SEM NÚCLEO",
          nome,
          endereco: norm(row[iEnd]),
          bairro: norm(row[iBairro]),
          cidade: norm(row[iCidade]),
          celular: norm(row[iCel]),
          idade: iIdade >= 0 && numOrNull(row[iIdade]) ? Math.round(numOrNull(row[iIdade])!) : null,
          altura: iAltura >= 0 ? numOrNull(row[iAltura]) : null,
          peso: iPeso >= 0 ? numOrNull(row[iPeso]) : null,
          sexo: norm(row[iSexo]),
          camiseta: norm(row[iCamiseta]),
          pagamento: norm(row[iPag]),
          observacao: norm(row[iObs]),
          cpf: iCpf >= 0 ? norm(row[iCpf]) : null,
        },
      });
      numeroToId.set(Math.round(numero), created.id);
      count++;
    }
    console.log("Fichas de neocampistas importadas:", count);

    // alertas F1..F8 referenciam número de outra ficha
    let alertaCount = 0;
    for (const row of fichas.slice(hFichaIdx + 1)) {
      const numero = numOrNull(row?.[iNum]);
      if (!numero) continue;
      const origemId = numeroToId.get(Math.round(numero));
      if (!origemId) continue;
      for (const col of alertaCols) {
        const alvoNumero = numOrNull(row[col]);
        if (!alvoNumero) continue;
        const alvoId = numeroToId.get(Math.round(alvoNumero));
        if (!alvoId || alvoId === origemId) continue;
        await db.fichaAlerta.upsert({
          where: { origemId_alvoId: { origemId, alvoId } },
          update: {},
          create: { origemId, alvoId },
        });
        alertaCount++;
      }
    }
    console.log("Alertas de ficha importados:", alertaCount);

    // ---------- aba 10: Divisão de Tribos ----------
    const triboSheet = sheet("Divisão de Tribos");
    let currentTribo: string | null = null;
    let triboCount = 0;
    for (const row of triboSheet) {
      if (!row) continue;
      const col0 = norm(row[0]);
      const col1 = norm(row[1]);
      if (col0 && col0.startsWith("TRIBO") && !col1) {
        currentTribo = col0;
        await db.tribo.upsert({
          where: { missaoId_nome: { missaoId: missao.id, nome: currentTribo } },
          update: {},
          create: { missaoId: missao.id, nome: currentTribo },
        });
        continue;
      }
      if (!currentTribo) continue;
      const numero = numOrNull(row[1]);
      if (!numero || col1 === "N° FICHA") continue;
      const fichaId = numeroToId.get(Math.round(numero));
      if (!fichaId) continue;
      const tribo = await db.tribo.findUnique({ where: { missaoId_nome: { missaoId: missao.id, nome: currentTribo } } });
      if (!tribo) continue;
      await db.neocampista.update({ where: { id: fichaId }, data: { triboId: tribo.id } });
      triboCount++;
    }
    console.log("Fichas alocadas em tribos:", triboCount);
  }

  console.log("Importação concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
