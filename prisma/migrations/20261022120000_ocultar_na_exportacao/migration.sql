-- AlterTable
ALTER TABLE "Pessoa" ADD COLUMN "ocultarNaExportacao" BOOLEAN NOT NULL DEFAULT false;

-- Richard e Lucimere (líderes) ficam ocultos por padrão
UPDATE "Pessoa" SET "ocultarNaExportacao" = true WHERE "id" IN (2637, 2638);
