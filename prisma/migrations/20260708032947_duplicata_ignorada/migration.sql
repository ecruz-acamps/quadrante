-- CreateTable
CREATE TABLE "DuplicataIgnorada" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pessoa1Id" INTEGER NOT NULL,
    "pessoa2Id" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DuplicataIgnorada_pessoa1Id_pessoa2Id_key" ON "DuplicataIgnorada"("pessoa1Id", "pessoa2Id");
