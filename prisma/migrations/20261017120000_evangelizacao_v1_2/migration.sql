-- CreateTable
CREATE TABLE "Cidade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CidadeApelido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "apelido" TEXT NOT NULL,
    "cidadeId" INTEGER NOT NULL,
    CONSTRAINT "CidadeApelido_cidadeId_fkey" FOREIGN KEY ("cidadeId") REFERENCES "Cidade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CidadeVizinha" (
    "cidadeId" INTEGER NOT NULL,
    "vizinhaId" INTEGER NOT NULL,

    PRIMARY KEY ("cidadeId", "vizinhaId"),
    CONSTRAINT "CidadeVizinha_cidadeId_fkey" FOREIGN KEY ("cidadeId") REFERENCES "Cidade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CidadeVizinha_vizinhaId_fkey" FOREIGN KEY ("vizinhaId") REFERENCES "Cidade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipeEvangelizacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "missaoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    CONSTRAINT "EquipeEvangelizacao_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Missao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "cercoSlug" TEXT NOT NULL,
    "valorInterna" REAL NOT NULL DEFAULT 160,
    "valorExterna" REAL NOT NULL DEFAULT 80,
    "valorCampista" REAL NOT NULL DEFAULT 300,
    "cercoPublicado" BOOLEAN NOT NULL DEFAULT true,
    "cercoMaxPorHorario" INTEGER NOT NULL DEFAULT 15,
    "mes" INTEGER,
    "anoCalendario" INTEGER,
    "dataInicio" TEXT,
    "dataFim" TEXT,
    "pixChave" TEXT,
    "contatoFinanceiro" TEXT,
    "evangelizacaoFechada" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Missao" ("ano", "anoCalendario", "cercoMaxPorHorario", "cercoPublicado", "cercoSlug", "contatoFinanceiro", "dataFim", "dataInicio", "id", "mes", "nome", "pixChave", "tipo", "valorCampista", "valorExterna", "valorInterna") SELECT "ano", "anoCalendario", "cercoMaxPorHorario", "cercoPublicado", "cercoSlug", "contatoFinanceiro", "dataFim", "dataInicio", "id", "mes", "nome", "pixChave", "tipo", "valorCampista", "valorExterna", "valorInterna" FROM "Missao";
DROP TABLE "Missao";
ALTER TABLE "new_Missao" RENAME TO "Missao";
CREATE UNIQUE INDEX "Missao_cercoSlug_key" ON "Missao"("cercoSlug");
CREATE TABLE "new_Neocampista" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "missaoId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "nucleo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "celular" TEXT,
    "idade" INTEGER,
    "altura" REAL,
    "peso" REAL,
    "sexo" TEXT,
    "camiseta" TEXT,
    "pagamento" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'OK',
    "observacao" TEXT,
    "cpf" TEXT,
    "triboId" INTEGER,
    "equipeEvangelizacaoId" INTEGER,
    "casaFixada" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Neocampista_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Neocampista_triboId_fkey" FOREIGN KEY ("triboId") REFERENCES "Tribo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Neocampista_equipeEvangelizacaoId_fkey" FOREIGN KEY ("equipeEvangelizacaoId") REFERENCES "EquipeEvangelizacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Neocampista" ("altura", "bairro", "camiseta", "celular", "cidade", "cpf", "endereco", "id", "idade", "missaoId", "nome", "nucleo", "numero", "observacao", "pagamento", "peso", "sexo", "situacao", "triboId") SELECT "altura", "bairro", "camiseta", "celular", "cidade", "cpf", "endereco", "id", "idade", "missaoId", "nome", "nucleo", "numero", "observacao", "pagamento", "peso", "sexo", "situacao", "triboId" FROM "Neocampista";
DROP TABLE "Neocampista";
ALTER TABLE "new_Neocampista" RENAME TO "Neocampista";
CREATE INDEX "Neocampista_triboId_idx" ON "Neocampista"("triboId");
CREATE INDEX "Neocampista_equipeEvangelizacaoId_idx" ON "Neocampista"("equipeEvangelizacaoId");
CREATE UNIQUE INDEX "Neocampista_missaoId_numero_key" ON "Neocampista"("missaoId", "numero");
CREATE TABLE "new_Servo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "missaoId" INTEGER NOT NULL,
    "pessoaId" INTEGER NOT NULL,
    "setor" TEXT NOT NULL,
    "funcao" TEXT NOT NULL DEFAULT 'INTEGRANTE',
    "camiseta" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    "formacao1" TEXT,
    "formacao2" TEXT,
    "formacao3" TEXT,
    "motivoFalta" TEXT,
    "pagamentoForma" TEXT,
    "pagamentoValor" REAL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "cercoHorario" TEXT,
    "motivoDesistiu" TEXT,
    "motivoRecusou" TEXT,
    "temCarro" BOOLEAN NOT NULL DEFAULT false,
    "equipeEvangelizacaoId" INTEGER,
    CONSTRAINT "Servo_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Servo_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Servo_equipeEvangelizacaoId_fkey" FOREIGN KEY ("equipeEvangelizacaoId") REFERENCES "EquipeEvangelizacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Servo" ("camiseta", "cercoHorario", "confirmado", "formacao1", "formacao2", "formacao3", "funcao", "id", "missaoId", "motivoDesistiu", "motivoFalta", "motivoRecusou", "observacoes", "pagamentoForma", "pagamentoValor", "pago", "pessoaId", "setor", "status") SELECT "camiseta", "cercoHorario", "confirmado", "formacao1", "formacao2", "formacao3", "funcao", "id", "missaoId", "motivoDesistiu", "motivoFalta", "motivoRecusou", "observacoes", "pagamentoForma", "pagamentoValor", "pago", "pessoaId", "setor", "status" FROM "Servo";
DROP TABLE "Servo";
ALTER TABLE "new_Servo" RENAME TO "Servo";
CREATE INDEX "Servo_missaoId_setor_idx" ON "Servo"("missaoId", "setor");
CREATE INDEX "Servo_pessoaId_idx" ON "Servo"("pessoaId");
CREATE INDEX "Servo_equipeEvangelizacaoId_idx" ON "Servo"("equipeEvangelizacaoId");
CREATE UNIQUE INDEX "Servo_missaoId_pessoaId_key" ON "Servo"("missaoId", "pessoaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Cidade_nome_key" ON "Cidade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CidadeApelido_apelido_key" ON "CidadeApelido"("apelido");

-- CreateIndex
CREATE INDEX "CidadeApelido_cidadeId_idx" ON "CidadeApelido"("cidadeId");

-- CreateIndex
CREATE INDEX "CidadeVizinha_vizinhaId_idx" ON "CidadeVizinha"("vizinhaId");

-- CreateIndex
CREATE INDEX "EquipeEvangelizacao_missaoId_idx" ON "EquipeEvangelizacao"("missaoId");
