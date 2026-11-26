-- CreateTable
CREATE TABLE "NucleoFichas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "missaoId" INTEGER NOT NULL,
    "nucleo" TEXT NOT NULL,
    "recebidas" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "NucleoFichas_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NucleoFichas_missaoId_nucleo_key" ON "NucleoFichas"("missaoId", "nucleo");

