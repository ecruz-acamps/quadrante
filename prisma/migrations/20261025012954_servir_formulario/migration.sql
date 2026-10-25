-- CreateTable
CREATE TABLE "Candidato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "missaoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "casado" BOOLEAN NOT NULL DEFAULT false,
    "conjugeNome" TEXT,
    "conjugeCelular" TEXT,
    "respostas" TEXT NOT NULL DEFAULT '[]',
    "disponivel" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "servoId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Candidato_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerguntaServir" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "opcoes" TEXT,
    "permiteOutra" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true
);

-- AlterTable
ALTER TABLE "Missao" ADD COLUMN "servirDatas" TEXT;
ALTER TABLE "Missao" ADD COLUMN "servirPublicado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Candidato_missaoId_status_idx" ON "Candidato"("missaoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Candidato_missaoId_cpf_key" ON "Candidato"("missaoId", "cpf");

-- CreateIndex
CREATE INDEX "PerguntaServir_ordem_idx" ON "PerguntaServir"("ordem");
