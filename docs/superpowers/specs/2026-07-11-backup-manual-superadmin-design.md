# Backup manual do banco (superadmin)

## Objetivo

Permitir que um usuário com role `SUPER` baixe uma cópia do banco SQLite (`prisma/quadrante.db`) diretamente do navegador, para guardar localmente como backup.

## Escopo

- Link "Backup" no menu admin, visível só para `SUPER`.
- Página `/backup` com um botão "Baixar backup".
- Route handler que copia o `.db` atual e o devolve como download, com nome `quadrante-backup-YYYY-MM-DD-HHmm.db`.

Fora de escopo (fica para depois): backup automático agendado / upload para Google Drive.

## Design

**Nav**: adicionar `["/backup", "Backup", true]` ao array `NAV` em `src/app/(admin)/layout.tsx` (mesmo padrão do item "Usuários").

**Página** `src/app/(admin)/backup/page.tsx`:
- Chama `requireRole("SUPER")` no topo (mesmo padrão de `usuarios/page.tsx`).
- Renderiza um botão/link `<a href="/api/backup">Baixar backup</a>` (download simples via navegação, sem precisar de client component).

**Route handler** `src/app/api/backup/route.ts` (GET):
1. Chama `requireRole("SUPER")` de novo dentro do handler (defesa em profundidade — a URL é acessível diretamente, não só pelo botão).
2. Resolve o caminho do banco a partir de `DATABASE_URL` (ou hardcode relativo a `prisma/quadrante.db`, já que é fixo no projeto).
3. Copia o arquivo para um caminho temporário via `fs.promises.copyFile` (cópia de sistema de arquivos é suficiente para o volume de uso deste app — SQLite é um único arquivo e não há escrita concorrente pesada esperada).
4. Lê os bytes do temporário com `fs.promises.readFile`.
5. Apaga o arquivo temporário (`fs.promises.unlink`), inclusive em caso de erro na leitura (try/finally).
6. Retorna `new Response(bytes, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="quadrante-backup-<timestamp>.db"' } })`, com `<timestamp>` no formato `YYYY-MM-DD-HHmm` gerado no momento da requisição.

**Erros**: se a cópia ou leitura falhar, retorna `500` com um corpo de texto simples de erro. Não precisa de UI de erro sofisticada — é uma ferramenta interna de superadmin.

## Teste manual

1. Login como usuário `SUPER` → menu mostra "Backup".
2. Acessar `/backup` → clicar "Baixar backup" → arquivo `.db` baixa com nome com timestamp.
3. Abrir o arquivo baixado com `sqlite3` (ou DB Browser for SQLite) e confirmar que os dados batem com o banco atual.
4. Login como usuário `ADMIN` (não-SUPER) → confirmar que o link não aparece no menu e que acessar `/backup` ou `/api/backup` diretamente redireciona/bloqueia.
