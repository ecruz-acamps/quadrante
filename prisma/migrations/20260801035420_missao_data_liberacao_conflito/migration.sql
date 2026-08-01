-- AlterTable
ALTER TABLE "Missao" ADD COLUMN "anoCalendario" INTEGER;
ALTER TABLE "Missao" ADD COLUMN "mes" INTEGER;

-- CreateTable
CREATE TABLE "LiberacaoConflitoServo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pessoaId" INTEGER NOT NULL,
    "missaoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" DATETIME NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LiberacaoConflitoServo_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LiberacaoConflitoServo_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LiberacaoConflitoServo_pessoaId_missaoId_idx" ON "LiberacaoConflitoServo"("pessoaId", "missaoId");
