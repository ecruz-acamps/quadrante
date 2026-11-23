-- AlterTable
ALTER TABLE "Neocampista" ADD COLUMN "arquivoCopiaDriveId" TEXT;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoCopiaId" TEXT;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoCopiaNome" TEXT;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoDriveId" TEXT;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoErro" TEXT;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoExt" TEXT;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoId" TEXT;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoNome" TEXT;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoTriboId" INTEGER;
ALTER TABLE "Neocampista" ADD COLUMN "arquivoUrl" TEXT;

-- CreateTable
CREATE TABLE "IntegracaoOneDrive" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conta" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "raizDriveId" TEXT,
    "raizId" TEXT,
    "raizNome" TEXT,
    "raizUrl" TEXT,
    "atualizadoEm" DATETIME NOT NULL
);

