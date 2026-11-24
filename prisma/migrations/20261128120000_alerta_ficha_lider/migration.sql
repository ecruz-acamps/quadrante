-- CreateTable
CREATE TABLE "FichaAlertaLider" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fichaId" INTEGER NOT NULL,
    "servoId" INTEGER NOT NULL,
    CONSTRAINT "FichaAlertaLider_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "Neocampista" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FichaAlertaLider_servoId_fkey" FOREIGN KEY ("servoId") REFERENCES "Servo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FichaAlertaLider_servoId_idx" ON "FichaAlertaLider"("servoId");

-- CreateIndex
CREATE UNIQUE INDEX "FichaAlertaLider_fichaId_servoId_key" ON "FichaAlertaLider"("fichaId", "servoId");

