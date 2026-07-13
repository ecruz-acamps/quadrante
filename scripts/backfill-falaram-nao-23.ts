/*
 * Backfill pontual: a 23ª edição não teve a aba "Falaram NÃO" importada porque o
 * cabeçalho dessa planilha usa "Nome" (não "NOME"), e o import-excel.ts só reconhecia
 * a variante maiúscula — a aba inteira foi pulada em silêncio.
 * Uso: npx tsx scripts/backfill-falaram-nao-23.ts "/caminho/23° Acampamento Sênior.xlsx"
 */
import path from "path";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const norm = (v: unknown) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" || s === "N/A" ? null : s;
};
const PREFIXO_FUNCAO = /^.*?:\s*/;
const normNome = (v: unknown) => {
  const s = norm(v);
  return s === null ? null : s.replace(PREFIXO_FUNCAO, "");
};

async function main() {
  const file = process.argv[2] || path.resolve(__dirname, "../../23° Acampamento Sênior.xlsx");
  const cercoSlug = "cercosenior23";

  const missao = await db.missao.findUnique({ where: { cercoSlug } });
  if (!missao) throw new Error(`Missão ${cercoSlug} não encontrada`);
  console.log("Missão:", missao.nome, "id=", missao.id);

  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Falaram NÃO"], { header: 1, defval: null });

  const header = rows[0] as any[];
  const iNome = header.findIndex((h) => norm(h)?.toLowerCase() === "nome");
  if (iNome < 0) throw new Error('Coluna "Nome" não encontrada na aba Falaram NÃO');
  const iTelefone = header.findIndex((h) => norm(h)?.toLowerCase() === "telefone");

  const pessoaCache = new Map<string, number>();
  async function getOrCreatePessoa(nome: string, celular: string | null) {
    const key = nome.toUpperCase();
    if (pessoaCache.has(key)) return pessoaCache.get(key)!;
    let pessoa = await db.pessoa.findFirst({ where: { nome } });
    if (!pessoa) pessoa = await db.pessoa.create({ data: { nome, celular } });
    pessoaCache.set(key, pessoa.id);
    return pessoa.id;
  }

  let criados = 0;
  let jaAtivos = 0;
  let jaRecusados = 0;

  for (const row of rows.slice(1)) {
    const nome = normNome(row?.[iNome]);
    if (!nome) continue;
    // a coluna "Telefone" da última linha do cabeçalho não bate com os dados reais desta
    // aba (endereço/bairro/cidade estão deslocados) — só aproveitamos o nome com segurança
    const celular = iTelefone >= 0 ? norm(row[iTelefone]) : null;
    const pessoaId = await getOrCreatePessoa(nome, /^\(?\d/.test(celular || "") ? celular : null);

    const existente = await db.servo.findUnique({
      where: { missaoId_pessoaId: { missaoId: missao.id, pessoaId } },
    });

    if (!existente) {
      await db.servo.create({
        data: { missaoId: missao.id, pessoaId, status: "RECUSOU", setor: "NÃO INFORMADO" },
      });
      criados++;
    } else if (existente.status === "ATIVO") {
      // já está no quadro como servo ativo em outra função — não sobrescreve, só avisa
      jaAtivos++;
      console.log(`  aviso: "${nome}" já é servo ATIVO nesta missão, não sobrescrito`);
    } else if (existente.status === "RECUSOU") {
      jaRecusados++;
    }
  }

  console.log("Criados como RECUSOU:", criados);
  console.log("Já eram RECUSOU:", jaRecusados);
  console.log("Pulados por já estarem ATIVO:", jaAtivos);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
