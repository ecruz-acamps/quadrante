-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EquipeEvangelizacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "missaoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EquipeEvangelizacao_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EquipeEvangelizacao" ("id", "missaoId", "nome") SELECT "id", "missaoId", "nome" FROM "EquipeEvangelizacao";
DROP TABLE "EquipeEvangelizacao";
ALTER TABLE "new_EquipeEvangelizacao" RENAME TO "EquipeEvangelizacao";
CREATE INDEX "EquipeEvangelizacao_missaoId_idx" ON "EquipeEvangelizacao"("missaoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
