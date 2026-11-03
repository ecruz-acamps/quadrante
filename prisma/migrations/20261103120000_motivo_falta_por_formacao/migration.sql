-- AlterTable
ALTER TABLE "Servo" ADD COLUMN "motivoFalta1" TEXT;
ALTER TABLE "Servo" ADD COLUMN "motivoFalta2" TEXT;
ALTER TABLE "Servo" ADD COLUMN "motivoFalta3" TEXT;

-- O motivo único antigo vai para a primeira formação em que a pessoa faltou
UPDATE "Servo" SET "motivoFalta1" = "motivoFalta" WHERE "motivoFalta" IS NOT NULL AND "formacao1" = 'Não';
UPDATE "Servo" SET "motivoFalta2" = "motivoFalta" WHERE "motivoFalta" IS NOT NULL AND "formacao1" IS NOT 'Não' AND "formacao2" = 'Não';
UPDATE "Servo" SET "motivoFalta3" = "motivoFalta" WHERE "motivoFalta" IS NOT NULL AND "formacao1" IS NOT 'Não' AND "formacao2" IS NOT 'Não' AND "formacao3" = 'Não';
