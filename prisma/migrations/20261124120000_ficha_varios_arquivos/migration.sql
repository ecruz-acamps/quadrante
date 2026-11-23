-- CreateTable
CREATE TABLE "FichaArquivo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "neocampistaId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ext" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT,
    "copiaDriveId" TEXT,
    "copiaItemId" TEXT,
    "copiaNome" TEXT,
    "copiaTriboId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FichaArquivo_neocampistaId_fkey" FOREIGN KEY ("neocampistaId") REFERENCES "Neocampista" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Arquivos que já existiam (um por ficha) passam para a tabela nova
INSERT INTO "FichaArquivo" ("neocampistaId", "ordem", "ext", "driveId", "itemId", "nome", "url", "copiaDriveId", "copiaItemId", "copiaNome", "copiaTriboId")
SELECT "id", 1, COALESCE("arquivoExt", ''), "arquivoDriveId", "arquivoId", COALESCE("arquivoNome", ''), "arquivoUrl", "arquivoCopiaDriveId", "arquivoCopiaId", "arquivoCopiaNome", "arquivoTriboId"
FROM "Neocampista" WHERE "arquivoId" IS NOT NULL AND "arquivoDriveId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "arquivoErro" TEXT,
    CONSTRAINT "Neocampista_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Neocampista_triboId_fkey" FOREIGN KEY ("triboId") REFERENCES "Tribo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Neocampista_equipeEvangelizacaoId_fkey" FOREIGN KEY ("equipeEvangelizacaoId") REFERENCES "EquipeEvangelizacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Neocampista" ("altura", "arquivoErro", "bairro", "camiseta", "casaFixada", "celular", "cidade", "cpf", "endereco", "equipeEvangelizacaoId", "id", "idade", "missaoId", "nome", "nucleo", "numero", "observacao", "pagamento", "peso", "sexo", "situacao", "triboId") SELECT "altura", "arquivoErro", "bairro", "camiseta", "casaFixada", "celular", "cidade", "cpf", "endereco", "equipeEvangelizacaoId", "id", "idade", "missaoId", "nome", "nucleo", "numero", "observacao", "pagamento", "peso", "sexo", "situacao", "triboId" FROM "Neocampista";
DROP TABLE "Neocampista";
ALTER TABLE "new_Neocampista" RENAME TO "Neocampista";
CREATE INDEX "Neocampista_triboId_idx" ON "Neocampista"("triboId");
CREATE INDEX "Neocampista_equipeEvangelizacaoId_idx" ON "Neocampista"("equipeEvangelizacaoId");
CREATE UNIQUE INDEX "Neocampista_missaoId_numero_key" ON "Neocampista"("missaoId", "numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FichaArquivo_neocampistaId_idx" ON "FichaArquivo"("neocampistaId");

