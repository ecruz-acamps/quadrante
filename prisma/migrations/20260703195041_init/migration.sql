-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Missao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "cercoSlug" TEXT NOT NULL,
    "valorInterna" REAL NOT NULL DEFAULT 160,
    "valorExterna" REAL NOT NULL DEFAULT 80,
    "valorCampista" REAL NOT NULL DEFAULT 300
);

-- CreateTable
CREATE TABLE "Pessoa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "celular" TEXT,
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "paroquia" TEXT,
    "sexo" TEXT,
    "camiseta" TEXT
);

-- CreateTable
CREATE TABLE "Servo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "missaoId" INTEGER NOT NULL,
    "pessoaId" INTEGER NOT NULL,
    "setor" TEXT NOT NULL,
    "funcao" TEXT NOT NULL DEFAULT 'INTEGRANTE',
    "camiseta" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "formacao1" TEXT,
    "formacao2" TEXT,
    "formacao3" TEXT,
    "motivoFalta" TEXT,
    "pagamentoForma" TEXT,
    "pagamentoValor" REAL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "cercoHorario" TEXT,
    CONSTRAINT "Servo_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Servo_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Neocampista" (
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
    CONSTRAINT "Neocampista_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Neocampista_triboId_fkey" FOREIGN KEY ("triboId") REFERENCES "Tribo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FichaAlerta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origemId" INTEGER NOT NULL,
    "alvoId" INTEGER NOT NULL,
    CONSTRAINT "FichaAlerta_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "Neocampista" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FichaAlerta_alvoId_fkey" FOREIGN KEY ("alvoId") REFERENCES "Neocampista" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tribo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "missaoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    CONSTRAINT "Tribo_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TriboLider" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "triboId" INTEGER NOT NULL,
    "servoId" INTEGER NOT NULL,
    CONSTRAINT "TriboLider_triboId_fkey" FOREIGN KEY ("triboId") REFERENCES "Tribo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TriboLider_servoId_fkey" FOREIGN KEY ("servoId") REFERENCES "Servo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Nucleo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Paroquia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cidade" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "paroquia" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Missao_cercoSlug_key" ON "Missao"("cercoSlug");

-- CreateIndex
CREATE INDEX "Servo_missaoId_setor_idx" ON "Servo"("missaoId", "setor");

-- CreateIndex
CREATE UNIQUE INDEX "Servo_missaoId_pessoaId_key" ON "Servo"("missaoId", "pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "Neocampista_missaoId_numero_key" ON "Neocampista"("missaoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "FichaAlerta_origemId_alvoId_key" ON "FichaAlerta"("origemId", "alvoId");

-- CreateIndex
CREATE UNIQUE INDEX "Tribo_missaoId_nome_key" ON "Tribo"("missaoId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "TriboLider_triboId_servoId_key" ON "TriboLider"("triboId", "servoId");

-- CreateIndex
CREATE UNIQUE INDEX "Setor_nome_key" ON "Setor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Nucleo_nome_key" ON "Nucleo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Paroquia_cidade_bairro_key" ON "Paroquia"("cidade", "bairro");
