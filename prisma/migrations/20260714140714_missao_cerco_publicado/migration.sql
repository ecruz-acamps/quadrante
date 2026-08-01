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
    "cercoPublicado" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Missao" ("ano", "cercoSlug", "id", "nome", "tipo", "valorCampista", "valorExterna", "valorInterna") SELECT "ano", "cercoSlug", "id", "nome", "tipo", "valorCampista", "valorExterna", "valorInterna" FROM "Missao";
DROP TABLE "Missao";
ALTER TABLE "new_Missao" RENAME TO "Missao";
CREATE UNIQUE INDEX "Missao_cercoSlug_key" ON "Missao"("cercoSlug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
