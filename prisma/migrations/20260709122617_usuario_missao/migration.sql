-- CreateTable
CREATE TABLE "UsuarioMissao" (
    "usuarioId" INTEGER NOT NULL,
    "missaoId" INTEGER NOT NULL,

    PRIMARY KEY ("usuarioId", "missaoId"),
    CONSTRAINT "UsuarioMissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsuarioMissao_missaoId_fkey" FOREIGN KEY ("missaoId") REFERENCES "Missao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
