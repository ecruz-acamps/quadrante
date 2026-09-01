-- CreateTable
CREATE TABLE "PushbirdDevice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "notificarConflito" BOOLEAN NOT NULL DEFAULT true,
    "notificarCerco" BOOLEAN NOT NULL DEFAULT true
);
