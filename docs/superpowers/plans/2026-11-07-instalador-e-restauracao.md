# Instalador de um comando e restauração pela interface — Plano de implementação

> **Para quem executa:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas `- [ ]`.

**Objetivo:** instalar o Quadrante num Debian 12 zerado com um comando, restaurar o backup do Drive por uma tela, e ligar o acesso pela internet (túnel Cloudflare) depois, por um campo nas Configurações.

**Arquitetura:** `install.sh` prepara a máquina (Node 22, pm2, usuário `quadrante`, app em `/opt/quadrante`, cron). Enquanto não houver usuários, o app oferece `/restaurar` (protegida por código de uso único) que usa `descriptografarArquivo` e `verificarSnapshot`. O túnel é criado pela API da Cloudflare a partir das Configurações e ligado por um auxiliar root mínimo chamado via `sudo`.

**Tecnologias:** Next.js 16 (App Router, `src/proxy.ts`), Prisma 6 + SQLite, `tsx --test`, bash, gpg, pm2, Docker (só para testar o instalador em `debian:12`).

**Spec:** `docs/superpowers/specs/2026-11-07-instalador-e-restauracao-design.md`

## Restrições globais

- **Next.js 16 muda APIs:** antes de escrever código de rota, página, layout, proxy ou redirect, ler em `node_modules/next/dist/docs/01-app/03-api-reference/`: `03-file-conventions/route.md`, `proxy.md`, `layout.md`, `page.md` e `04-functions/redirect.md`, `not-found.md` (regra do `AGENTS.md`). O interceptador é `src/proxy.ts`.
- Banco SQLite via Prisma 6; `DATABASE_URL="file:./quadrante.db"` é relativo a `prisma/`.
- Formato do backup (não mudar): `quadrante-backup-AAAA-MM-DD-HHMM.tar.gz.gpg` = gpg simétrico AES256 de um `tar.gz` com `prisma/quadrante.db` e `.env`. Reutilizar `descriptografarArquivo` (`src/lib/criptografia.ts`) e `verificarSnapshot` (`src/lib/snapshotDb.ts`).
- Instalador: Debian 12, root, `curl -fsSL https://raw.githubusercontent.com/ecruz-acamps/quadrante/main/install.sh | sudo bash`; app em `/opt/quadrante` (`QUADRANTE_DIR`), usuário de sistema `quadrante`, porta `3008`, Node 22 pelo NodeSource, pm2. Rodar de novo atualiza e **nunca** troca `AUTH_SECRET`/`BACKUP_PASSPHRASE` nem apaga banco.
- Cron (usuário `quadrante`): backup 03:00 e alarme de silêncio 09:00, só funcionam se o `.env` tiver `BACKUP_PASSPHRASE` (guarda na própria linha).
- `/restaurar` só existe com a tabela `Usuario` vazia, checado em **toda** requisição; exige código de uso único (`RESTAURACAO_CODIGO`); 5 tentativas por 15 min; upload até 200 MB.
- Token da API da Cloudflare: usado uma vez, **nunca** gravado em disco, `.env`, backup ou log. Rota `endereço → http://localhost:3008`; DNS `CNAME` para `<id>.cfargotunnel.com` com proxy; trocar DNS já existente exige confirmação; o auxiliar `/usr/local/sbin/quadrante-tunel` é o **único** comando que `quadrante` roda como root.
- Textos de tela e mensagens de erro em português.
- **Produção ao vivo nesta pasta:** não rodar `npm run build`, `pm2 restart` nem tocar em `prisma/quadrante.db`. Testes usam `criarBancoTemporario()`; dev (`npm run dev`, porta 3005) só com cópia do banco.
- Trabalhar na branch `instalador-restauracao` (criar a partir de `main`). Mensagens de commit terminam com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Sem `push`/merge sem o dono pedir.
- **Ordem e corte:** Tarefas 1–8 (instalador e restauração) vêm antes do túnel (9–12). Se o prazo apertar, parar na 8, fazer a 13 só para essa parte, e o túnel sobe à mão.

## Foco da revisão (o que os testes das tarefas precisam travar)

1. Arquivo de backup ruim (não-gpg, truncado, tar com `../` ou sem `.env`/banco): recusa em português e **nada** é substituído. → Tarefa 3.
2. Dois envios ao mesmo tempo, ou envio quando já há usuário: o segundo é recusado; nunca sobrescreve sistema em uso. → Tarefas 1 e 5.
3. Backup de esquema incompatível: a migração falha e os arquivos originais voltam, o app continua de pé. → Tarefa 3.
4. Token ou endereço malicioso (espaço, quebra de linha, `;`, maiúsculas, curinga): recusado antes de chegar à API ou ao auxiliar root. → Tarefas 9 e 11.
5. Endereço que já tem DNS (CNAME de outro túnel ou registro A) e token sem permissão: pede confirmação ou explica a permissão que falta; nenhum túnel é criado antes da confirmação. → Tarefa 10.

---

### Tarefa 1: Sistema vazio e código de restauração

**Arquivos:**
- Criar: `src/lib/sistemaVazio.ts`, `src/lib/codigoRestauracao.ts`
- Teste: `src/lib/sistemaVazio.test.ts`, `src/lib/codigoRestauracao.test.ts`

**Interfaces:**
- Produz: `sistemaVazio(): Promise<boolean>` (true se `db.usuario.count() === 0`).
- Produz: `gerarCodigoRestauracao(): string` (formato `XXXX-XXXX-XXXX`, hexadecimal maiúsculo).
- Produz: `codigoConfere(esperado: string | undefined, informado: string): boolean` (ignora hífens, espaços e caixa; **false** se `esperado` for vazio/indefinido, mesmo com `informado` vazio; compara em tempo constante).
- Produz: `tentativaBloqueada(): boolean` e `limparTentativas(): void` (usam `excedeuLimite("restaurar", 5, 15 * 60_000)` e `limparLimite("restaurar")` de `src/lib/rateLimit.ts`; chave **global**, não por IP).
- Produz: `iniciarRestauracao(): (() => void) | null` — trava em memória; devolve a função que libera, ou `null` se já houver uma restauração em andamento.

- [ ] **Passo 1: Escrever os testes que falham.** Em `sistemaVazio.test.ts` (padrão de `snapshotDb.test.ts`: `criarBancoTemporario()`, `process.env.DATABASE_URL = banco.url`, import dinâmico):
```ts
test("true com a tabela Usuario vazia", async () => { assert.equal(await sistemaVazio(), true); });
test("false depois de criar um usuário", async () => {
  await db.usuario.create({ data: { nome: "A", email: "a@x.com", role: "SUPER" } });
  assert.equal(await sistemaVazio(), false);
});
```
Em `codigoRestauracao.test.ts`:
```ts
test("gera XXXX-XXXX-XXXX hexadecimal maiúsculo", () => assert.match(gerarCodigoRestauracao(), /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/));
test("confere ignora caixa, hífens e espaços", () => assert.equal(codigoConfere("ABCD-1234-EF56", " abcd1234ef56 "), true));
test("recusa código errado", () => assert.equal(codigoConfere("ABCD-1234-EF56", "ABCD-1234-EF57"), false));
test("recusa quando não há código esperado, mesmo informado vazio", () => {
  assert.equal(codigoConfere(undefined, ""), false);
  assert.equal(codigoConfere("", ""), false);
});
test("bloqueia na 6ª tentativa e libera após limparTentativas", () => {
  limparTentativas();
  for (let i = 0; i < 5; i++) assert.equal(tentativaBloqueada(), false);
  assert.equal(tentativaBloqueada(), true);
  limparTentativas();
  assert.equal(tentativaBloqueada(), false);
});
test("iniciarRestauracao: segunda chamada recebe null até liberar", () => {
  const liberar = iniciarRestauracao();
  assert.ok(liberar);
  assert.equal(iniciarRestauracao(), null);
  liberar!();
  assert.ok(iniciarRestauracao());
});
```
- [ ] **Passo 2:** `npx tsx --test src/lib/sistemaVazio.test.ts src/lib/codigoRestauracao.test.ts` → FALHA (módulos inexistentes).
- [ ] **Passo 3: Implementar** os dois arquivos com as assinaturas acima (`crypto.randomBytes`/`timingSafeEqual`; normalizar com `replace(/[^0-9A-Za-z]/g, "").toUpperCase()`).
- [ ] **Passo 4:** mesmo comando → PASSA.
- [ ] **Passo 5: Commit** (`git checkout -b instalador-restauracao` antes, na primeira vez): `feat: detectar sistema vazio e validar código de restauração`.

---

### Tarefa 2: Ler e remover valores do `.env`

**Arquivos:**
- Modificar: `src/lib/envFile.ts`
- Teste: `src/lib/envFile.test.ts`

**Interfaces:**
- Produz: `setEnvValue(key: string, value: string, caminho?: string): Promise<void>` (hoje sem o 3º parâmetro; padrão continua `process.cwd()/.env`).
- Produz: `removeEnvValue(key: string, caminho?: string): Promise<void>` (remove a linha `KEY=...`, preserva o resto, e apaga `process.env[key]`).
- Produz: `lerEnvValor(caminho: string, key: string): Promise<string | undefined>` (valor sem aspas; `undefined` se ausente).

- [ ] **Passo 1: Testes que falham** (arquivo em `mkdtemp`):
```ts
test("setEnvValue acrescenta e atualiza sem perder as outras linhas", async () => { /* A="1" → set B → set A=2; conteúdo tem A="2" e B="..." */ });
test("removeEnvValue remove só a chave pedida", async () => { /* A, B → remove A → só B */ });
test("lerEnvValor lê com e sem aspas e devolve undefined se faltar", async () => {
  /* arquivo: X="a b"\nY=c → "a b", "c", undefined */
});
```
- [ ] **Passo 2:** `npx tsx --test src/lib/envFile.test.ts` → FALHA.
- [ ] **Passo 3: Implementar** (reaproveitar a regex existente; o 3º parâmetro default `ENV_PATH`).
- [ ] **Passo 4:** mesmo comando → PASSA.
- [ ] **Passo 5: Commit:** `feat: envFile lê e remove chaves`.

---

### Tarefa 3: Núcleo da restauração do backup

**Arquivos:**
- Criar: `src/lib/restaurarBackup.ts`
- Teste: `src/lib/restaurarBackup.test.ts`

**Interfaces:**
- Consome: `descriptografarArquivo`, `criptografarArquivo` (`criptografia.ts`); `verificarSnapshot` (`snapshotDb.ts`); `lerEnvValor` (Tarefa 2); `iniciarRestauracao` (Tarefa 1, usada na Tarefa 5).
- Produz: `type CodigoErroRestauracao = "SENHA" | "FORMATO" | "BANCO_REPROVADO" | "MIGRACAO"`.
- Produz: `class ErroRestauracao extends Error { codigo: CodigoErroRestauracao }` (mensagem em português para a tela).
- Produz: `type BackupPreparado = { pasta: string; arquivoBanco: string; arquivoEnv: string; pessoas: number }`.
- Produz: `prepararBackup(arquivoCifrado: string, senha: string): Promise<BackupPreparado>` — descriptografa em pasta temporária; lista o `tar` **antes** de extrair e exige exatamente `prisma/quadrante.db` e `.env` (e `prisma/`), senão `FORMATO`; erro do gpg com "decryption failed"/"bad session key" → `SENHA`, qualquer outro → `FORMATO`; banco reprovado por `verificarSnapshot` **ou com 0 pessoas** → `BANCO_REPROVADO`. Em qualquer erro apaga a pasta temporária.
- Produz: `aplicarBackup(p: BackupPreparado, o: { appDir: string; desconectar: () => Promise<void>; migrar: (env: NodeJS.ProcessEnv) => Promise<void> }): Promise<void>` — destino do banco = `DATABASE_URL` lido do `.env` **restaurado** (relativo a `appDir/prisma`); chama `desconectar()`; guarda o banco e o `.env` atuais como `*.bak-antes-restauracao`; grava os novos por arquivo `.novo` + `rename`; roda `migrar` com o `DATABASE_URL` novo; se `migrar` falhar, **devolve os originais** e lança `ErroRestauracao("MIGRACAO")`.
- Produz: `migrarComPrisma(appDir: string): (env: NodeJS.ProcessEnv) => Promise<void>` (executa `prisma migrate deploy` via `node node_modules/prisma/build/index.js`, sem shell).

- [ ] **Passo 1: Testes que falham** (ajudante no teste `fazerBackup(opcoes)`: banco de `criarBancoTemporario()` com 1 `Pessoa`, `.env` com `DATABASE_URL="file:./quadrante.db"` e `AUTH_SECRET="do-backup"`, `tar -czf` e `criptografarArquivo` com senha `senha-de-teste-123`):
```ts
test("prepararBackup devolve 1 pessoa e os caminhos extraídos", ...);                 // ok
test("senha errada → SENHA", ...);
test("arquivo que não é gpg → FORMATO", ...);                                          // texto comum
test("tar com entrada ../fora.txt → FORMATO e nada criado fora da pasta", ...);        // usar tar --transform ou -P
test("tar sem .env → FORMATO", ...);
test("banco sem nenhuma pessoa → BANCO_REPROVADO", ...);
test("aplicarBackup troca banco e .env e guarda os .bak-antes-restauracao", ...);
test("migrar que falha devolve os originais e lança MIGRACAO", async () => {
  /* conteúdo original de banco e .env idêntico ao de antes; rejeita com codigo === "MIGRACAO" */
});
```
- [ ] **Passo 2:** `npx tsx --test src/lib/restaurarBackup.test.ts` → FALHA.
- [ ] **Passo 3: Implementar** conforme as interfaces (`execFile` sem shell; `fs.rename` para trocar).
- [ ] **Passo 4:** mesmo comando → PASSA; `npx tsc --noEmit` sem erros novos.
- [ ] **Passo 5: Commit:** `feat: restauração de backup com validação e reversão`.

---

### Tarefa 4: Administrador inicial ("começar do zero")

**Arquivos:**
- Criar: `src/lib/adminInicial.ts`
- Teste: `src/lib/adminInicial.test.ts`

**Interfaces:**
- Consome: `sistemaVazio` (Tarefa 1); `bcryptjs` como em `prisma/seed.ts`.
- Produz: `criarAdministrador(d: { nome: string; email: string; senha: string }): Promise<void>` — cria `Usuario` com `role: "SUPER"` e senha em hash; lança `Error` com mensagem em português se: nome vazio; e-mail inválido; senha com menos de 10 caracteres; ou `!(await sistemaVazio())` ("O sistema já possui usuários.").

- [ ] **Passo 1: Testes que falham** (banco temporário): cria SUPER com hash que confere (`bcrypt.compare`); e-mail em minúsculas e sem espaços; recusa senha de 9 caracteres; recusa e-mail `sem-arroba`; recusa quando já existe usuário (e não cria outro).
- [ ] **Passo 2:** `npx tsx --test src/lib/adminInicial.test.ts` → FALHA.
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4:** → PASSA.
- [ ] **Passo 5: Commit:** `feat: criar administrador inicial`.

---

### Tarefa 5: Guarda de acesso e rotas da API de restauração

**Arquivos:**
- Criar: `src/lib/guardaRestauracao.ts`, `src/lib/reiniciar.ts`, `src/app/api/restaurar/route.ts`, `src/app/api/restaurar/zero/route.ts`
- Modificar: `src/proxy.ts` (matcher: acrescentar `api/restaurar` à lista de exclusões, para o corpo de até 200 MB não ser bufferizado/limitado a 10 MB)
- Teste: `src/lib/guardaRestauracao.test.ts`

**Interfaces:**
- Consome: Tarefas 1–4.
- Produz: `guardarAcesso(codigo: string): Promise<Response | null>` — ordem: `!sistemaVazio()` → `404`; `tentativaBloqueada()` → `429`; `!codigoConfere(process.env.RESTAURACAO_CODIGO, codigo)` → `403`; senão `null`. Corpo das respostas: JSON `{ erro: string }` em português (o 404 usa "Não encontrado").
- Produz: `agendarReinicio(): void` em `reiniciar.ts` (`setTimeout(() => process.exit(0), 800)`; o pm2 sobe de novo relendo `.env` e banco).
- Produz: `POST /api/restaurar` (multipart: `codigo`, `senha`, `arquivo`): `guardarAcesso` → recusa `arquivo` > 200 MB (400) → `iniciarRestauracao()` (null → 409 "Já existe uma restauração em andamento") → grava o arquivo em pasta temporária → `prepararBackup` → `aplicarBackup(..., desconectar: () => db.$disconnect(), migrar: migrarComPrisma(process.cwd()))` → `limparTentativas()` → `agendarReinicio()` → `200 { ok: true }`. `ErroRestauracao` → 400 com a mensagem; outros → 500 genérico (sem vazar caminhos). Libera a trava e apaga temporários sempre.
- Produz: `POST /api/restaurar/zero` (JSON `{ codigo, nome, email, senha }`): `guardarAcesso` → `criarAdministrador` → `removeEnvValue("RESTAURACAO_CODIGO")` → `limparTentativas()` → `200 { ok: true }` (sem reiniciar).

- [ ] **Passo 1: Ler** `route.md` e `proxy.md` (Restrições globais).
- [ ] **Passo 2: Testes que falham** em `guardaRestauracao.test.ts` (banco temporário, `process.env.RESTAURACAO_CODIGO = "AAAA-BBBB-CCCC"`, `limparTentativas()` antes de cada):
```ts
test("404 quando já existe usuário, mesmo com código certo", ...);
test("403 com código errado e 200 (null) com o certo", ...);
test("429 na 6ª tentativa errada, mesmo que a 6ª esteja certa", ...);
test("o 404 vem antes do 429 e do 403", ...);   // com usuário existente e bloqueado
```
- [ ] **Passo 3:** `npx tsx --test src/lib/guardaRestauracao.test.ts` → FALHA.
- [ ] **Passo 4: Implementar** guarda, `reiniciar.ts`, as duas rotas (finas, sem lógica própria além da orquestração acima) e o ajuste do matcher.
- [ ] **Passo 5:** teste → PASSA; `npx tsc --noEmit` e `npm run lint` sem erros novos.
- [ ] **Passo 6: Commit:** `feat: API de restauração protegida por código`.

---

### Tarefa 6: Tela `/restaurar` e redirecionamento do login

**Arquivos:**
- Criar: `src/app/restaurar/page.tsx`, `src/app/restaurar/RestaurarForm.tsx`, `src/app/login/layout.tsx`

**Interfaces:**
- Consome: `sistemaVazio` (Tarefa 1); `POST /api/restaurar` e `POST /api/restaurar/zero` (Tarefa 5).
- Produz: `/restaurar` (servidor): `if (!(await sistemaVazio())) notFound()`; renderiza `RestaurarForm`.
- Produz: `RestaurarForm` (cliente) com dois blocos: **Restaurar backup** (campos código, arquivo `.tar.gz.gpg`, senha do backup) e **Começar do zero** (código, nome, e-mail, senha). Envia por `fetch`; mostra `erro` da resposta; ao sucesso do backup mostra "Backup restaurado. O sistema está reiniciando…" e consulta `/login` a cada 2 s (até 60 s) antes de ir para `/login`; no "do zero" vai direto ao `/login`.
- Produz: `src/app/login/layout.tsx` (servidor): se `sistemaVazio()` → `redirect("/restaurar")`; senão renderiza `children`.

- [ ] **Passo 1: Ler** `layout.md`, `page.md`, `redirect.md`, `not-found.md`. Reaproveitar as classes e variáveis visuais de `src/app/login/page.tsx` (mesma paleta e tipografia).
- [ ] **Passo 2: Implementar** os três arquivos.
- [ ] **Passo 3: Verificar:** `npx tsc --noEmit` e `npm run lint` limpos; `npm test` continua passando (inclui `protecao-paginas.test.ts`, que só varre `(admin)`).
- [ ] **Passo 4: Commit:** `feat: tela de restauração e redirecionamento do login`.

---

### Tarefa 7: Instalador `install.sh` (sem túnel)

**Arquivos:**
- Criar: `install.sh`, `scripts/teste-instalador.sh`
- Modificar: `ecosystem.config.cjs` (`cwd: __dirname`, em vez do caminho fixo)

**Interfaces:**
- Produz: `install.sh` com variáveis opcionais `QUADRANTE_DIR` (`/opt/quadrante`), `QUADRANTE_REPO` (`https://github.com/ecruz-acamps/quadrante.git`), `QUADRANTE_BRANCH` (`main`). Etapas, cada uma com `etapa "…"` e seguras de repetir, no estilo do `instalar.sh` do repositório `pre-fichas_acampamento` (cores, `set -euo pipefail`, falha clara se não for root):
  1. `apt-get install -y git curl ca-certificates gnupg openssl tar cron sudo`.
  2. Node 22 via `https://deb.nodesource.com/setup_22.x` (só se o `node` não for versão 22); `npm i -g pm2`.
  3. Usuário `quadrante` (`useradd --system --create-home --home-dir /home/quadrante --shell /usr/sbin/nologin`); `/var/log/quadrante` do `quadrante`.
  4. Clonar em `$QUADRANTE_DIR` (ou `git pull --ff-only` se existir); em atualização com banco existente, copiar antes para `prisma/quadrante.db.bak-antes-deploy-AAAAMMDD`.
  5. Se **não** houver `.env`: criar (modo 600) com `DATABASE_URL="file:./quadrante.db"`, `AUTH_SECRET` (`openssl rand -hex 32`) e `RESTAURACAO_CODIGO` (`XXXX-XXXX-XXXX`, de `openssl rand -hex 6`). Se houver: não tocar.
  6. Como `quadrante` (`runuser -u quadrante --`): `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run build`.
  7. `pm2 start ecosystem.config.cjs`, `pm2 save` e `pm2 startup systemd -u quadrante --hp /home/quadrante` (falha vira aviso, não aborta: contêiner de teste não tem systemd).
  8. Cron do `quadrante` com bloco entre `# >>> quadrante >>>` e `# <<< quadrante <<<` (substituído a cada execução, nunca duplicado), `PATH=/usr/bin:/bin`, linhas `0 3 * * *` (`scripts/backup-to-drive.ts`) e `0 9 * * *` (`scripts/verificar-backup.ts`), cada uma só roda se `grep -q '^BACKUP_PASSPHRASE=' $QUADRANTE_DIR/.env`, saída em `/var/log/quadrante/backup.log`.
  9. Aviso se `timedatectl`/`/etc/timezone` não for `America/Sao_Paulo`.
  10. Mensagem final: `http://<IP>:3008/restaurar`, o código de uso único e "depois de restaurar, ligue o acesso pela internet em Configurações".
- Produz: `scripts/teste-instalador.sh` (roda no host, exige Docker e o código **commitado**): sobe `debian:12` com o repositório local montado em `/fonte` (somente leitura) e executa `QUADRANTE_REPO=/fonte QUADRANTE_BRANCH=$(git branch --show-current) bash /fonte/install.sh`.

- [ ] **Passo 1: Escrever** `scripts/teste-instalador.sh` com estas verificações (cada uma imprime `OK`/`FALHOU` e o script sai ≠ 0 se alguma falhar): 1ª execução termina com código 0 e a saída contém `/restaurar`; `curl -s -o /dev/null -w '%{http_code}' http://localhost:3008/restaurar` = `200`; `.env` tem `AUTH_SECRET=` e `RESTAURACAO_CODIGO=`, com modo `600`; `runuser -u quadrante -- pm2 pid quadrante` não vazio; 2ª execução termina com 0 e o `AUTH_SECRET` é idêntico ao da 1ª; `crontab -u quadrante -l | grep -c 'backup-to-drive'` = `1` e `grep -c '>>> quadrante'` = `1`.
- [ ] **Passo 2:** `git commit` do instalador e do script (o teste monta a branch commitada), depois `bash scripts/teste-instalador.sh` → FALHA (instalador ainda sem etapas completas). Se `docker pull debian:12` não funcionar na máquina, parar e avisar o dono.
- [ ] **Passo 3: Implementar** `install.sh` e o ajuste do `ecosystem.config.cjs`.
- [ ] **Passo 4:** commit, `bash scripts/teste-instalador.sh` → todas as verificações `OK` (leva vários minutos: `npm ci` e build).
- [ ] **Passo 5: Commit:** `feat: instalador de um comando`.

---

### Tarefa 8: Restauração ponta a ponta no contêiner

**Arquivos:**
- Criar: `scripts/gerar-backup-teste.ts`
- Modificar: `scripts/teste-instalador.sh` (acrescentar a fase de restauração)

**Interfaces:**
- Consome: `criarBancoTemporario` (`src/lib/testdb.ts`), `criptografarArquivo`, `bcryptjs`.
- Produz: `npx tsx scripts/gerar-backup-teste.ts <pastaSaida> <senha>` → imprime o caminho de um `quadrante-backup-teste.tar.gz.gpg` **sintético** (banco migrado com 1 `Pessoa` e 1 `Usuario` SUPER `teste@quadrante.local`, e `.env` com `DATABASE_URL="file:./quadrante.db"`, `AUTH_SECRET="segredo-do-backup"`, `BACKUP_PASSPHRASE="<senha>"`). Nunca usa o banco real.

- [ ] **Passo 1: Acrescentar ao teste** (após a instalação, dentro do contêiner, como `quadrante`): gerar o backup sintético; `curl` com código **errado** → `403`; com código certo e `senha` errada → `400`; com arquivo de texto comum → `400`; com tudo certo → `200` e `{"ok":true}`; aguardar o pm2 subir de novo; então `/restaurar` → `404`; `/login` → `200` sem redirecionar; `.env` contém `AUTH_SECRET="segredo-do-backup"`; uma consulta Prisma conta `1` usuário; novo `curl` de restauração → `404`.
- [ ] **Passo 2:** `bash scripts/teste-instalador.sh` → FALHA nas novas verificações (gerador inexistente).
- [ ] **Passo 3: Implementar** `scripts/gerar-backup-teste.ts`.
- [ ] **Passo 4:** commit e `bash scripts/teste-instalador.sh` → todas `OK`. Se alguma verificação do fluxo real falhar, corrigir a tarefa 3, 5 ou 6 (não ajustar o teste para passar).
- [ ] **Passo 5: Commit:** `test: restauração ponta a ponta no instalador`.

---

### Tarefa 9: Cliente da API da Cloudflare

**Arquivos:**
- Criar: `src/lib/cloudflare.ts`
- Teste: `src/lib/cloudflare.test.ts`

**Interfaces:**
- Produz: `type FetchFn = typeof fetch`; `class ErroCloudflare extends Error { status: number }` (mensagens em português; status 401/403 → "O token não tem permissão para …" citando a permissão que falta).
- Produz: `hostnameValido(h: string): boolean` — minúsculas, ≥ 2 rótulos de `[a-z0-9-]` sem hífen nas pontas, sem `*`, espaço, barra, `:`, quebra de linha ou ponto duplicado.
- Produz: `verificarToken(f: FetchFn, token: string): Promise<void>` (`GET /user/tokens/verify`).
- Produz: `localizarZona(f: FetchFn, token: string, hostname: string): Promise<{ contaId: string; zonaId: string }>` — tenta `GET /zones?name=` do mais longo ao mais curto sufixo (`a.b.exemplo.com`, `b.exemplo.com`, `exemplo.com`); sem resultado → `ErroCloudflare` "Domínio não encontrado nesta conta".
- Produz: `lerRegistroDns(f, token, zonaId, hostname): Promise<{ id: string; tipo: string; conteudo: string } | null>`.
- Produz: `criarTunel(f, token, contaId, nome): Promise<{ id: string; tokenTunel: string }>` (`POST /accounts/{conta}/cfd_tunnel` com `config_src: "cloudflare"`; se a resposta não trouxer o token, `GET …/cfd_tunnel/{id}/token`).
- Produz: `definirRota(f, token, contaId, tunelId, hostname, servico): Promise<void>` (`PUT …/configurations` com `ingress: [{ hostname, service }, { service: "http_status:404" }]`).
- Produz: `gravarRegistroDns(f, token, zonaId, hostname, tunelId, existenteId?): Promise<void>` (`CNAME`, `content = "<tunelId>.cfargotunnel.com"`, `proxied: true`; `POST` se novo, `PUT …/dns_records/{id}` se existir).
- Confirmar caminhos e formatos na documentação atual da Cloudflare (ferramenta `search_cloudflare_documentation`) antes de implementar.

- [ ] **Passo 1: Testes que falham** com um `fetch` falso que registra `{ método, url, cabeçalhos, corpo }` e responde `{ success: true, result: … }`:
```ts
test("hostnameValido aceita quadrante.movimentocampista.com.br", ...);
test("hostnameValido recusa: Quadrante.exemplo.com, *.exemplo.com, exemplo, 'a b.com', 'a.com\\n', https://a.com, a..com", ...);
test("localizarZona tenta a.b.exemplo.com, b.exemplo.com, exemplo.com nessa ordem", ...);
test("localizarZona sem resultado → ErroCloudflare 'Domínio não encontrado'", ...);
test("criarTunel envia config_src cloudflare e Authorization Bearer e devolve id e tokenTunel", ...);
test("definirRota envia ingress com hostname→http://localhost:3008 e http_status:404", ...);
test("gravarRegistroDns: POST CNAME proxied sem existente; PUT com existente", ...);
test("resposta 403 vira ErroCloudflare com 'permissão' e sem o token na mensagem", ...);
```
- [ ] **Passo 2:** `npx tsx --test src/lib/cloudflare.test.ts` → FALHA.
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4:** → PASSA.
- [ ] **Passo 5: Commit:** `feat: cliente da API da Cloudflare`.

---

### Tarefa 10: Orquestração "criar e ativar túnel"

**Arquivos:**
- Criar: `src/lib/tunelCloudflare.ts`
- Teste: `src/lib/tunelCloudflare.test.ts`

**Interfaces:**
- Consome: Tarefa 9.
- Produz: `type EntradaTunel = { tokenApi: string; hostname: string; confirmarTrocaDns: boolean }`.
- Produz: `type ResultadoTunel = { estado: "OK"; hostname: string; tunelId: string } | { estado: "CONFIRMAR_TROCA"; atual: { tipo: string; conteudo: string } }`.
- Produz: `type DependenciasTunel = { fetch: FetchFn; ligar: (tokenTunel: string) => Promise<void> }`.
- Produz: `criarEAtivarTunel(e: EntradaTunel, d: DependenciasTunel): Promise<ResultadoTunel>` — ordem: validar hostname → `verificarToken` → `localizarZona` → `lerRegistroDns`; se já existe registro e `!confirmarTrocaDns` → devolve `CONFIRMAR_TROCA` **sem criar nada**; senão `criarTunel` (nome `quadrante-AAAAMMDD`) → `definirRota` (`http://localhost:3008`) → `d.ligar(tokenTunel)` → **por último** `gravarRegistroDns` (o DNS só muda depois que o serviço está ligado). Nada devolvido nem lançado contém `tokenApi`.

- [ ] **Passo 1: Testes que falham** (com `fetch` falso e `ligar` falso que registra chamadas):
```ts
test("DNS existente sem confirmação → CONFIRMAR_TROCA, sem criar túnel nem chamar ligar", ...);
test("registro A existente também pede confirmação", ...);
test("com confirmação: ordem criarTunel → definirRota → ligar → gravarRegistroDns", ...);
test("sem DNS existente: OK sem confirmação", ...);
test("ligar que falha → rejeita e o DNS não é gravado", ...);
test("hostname inválido → rejeita antes de qualquer fetch", ...);
test("token sem permissão (403) → mensagem com a permissão e nenhum túnel criado", ...);
test("resultado e mensagens de erro nunca contêm o tokenApi", ...);
```
- [ ] **Passo 2:** `npx tsx --test src/lib/tunelCloudflare.test.ts` → FALHA.
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4:** → PASSA.
- [ ] **Passo 5: Commit:** `feat: criar e ativar túnel Cloudflare`.

---

### Tarefa 11: Auxiliar root `quadrante-tunel` e instalador

**Arquivos:**
- Criar: `scripts/quadrante-tunel`, `scripts/quadrante-cloudflared.service`, `scripts/teste-quadrante-tunel.sh`
- Modificar: `install.sh` (nova etapa antes da mensagem final)

**Interfaces:**
- Produz: `/usr/local/sbin/quadrante-tunel <ligar|desligar|status>` (root, bash, `set -euo pipefail`):
  - `ligar`: lê **uma linha** do stdin; valida `^[A-Za-z0-9+/=_-]{50,2000}$`, senão sai com código `2` sem escrever nada; grava `/etc/quadrante/cloudflared.env` (modo 600, `TUNNEL_TOKEN=<token>`) e roda `systemctl enable --now quadrante-cloudflared`.
  - `desligar`: `systemctl disable --now quadrante-cloudflared`.
  - `status`: imprime `ativo` ou `inativo` (`systemctl is-active`).
  - Qualquer outro argumento ou argumentos extras: código `2`.
  - O token nunca vai em argumento de processo (por isso o serviço próprio com `EnvironmentFile`, em vez de `cloudflared service install <token>`).
- Produz: `scripts/quadrante-cloudflared.service` (`ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run`, `EnvironmentFile=/etc/quadrante/cloudflared.env`, `Restart=always`).
- Produz, no `install.sh`: instala `cloudflared` pelo repositório apt da Cloudflare (`pkg.cloudflare.com`, Debian 12 `bookworm`); copia o auxiliar para `/usr/local/sbin` (dono root, 755) e a unidade para `/etc/systemd/system/` (**sem** habilitar); cria `/etc/sudoers.d/quadrante` com `quadrante ALL=(root) NOPASSWD: /usr/local/sbin/quadrante-tunel ligar, /usr/local/sbin/quadrante-tunel desligar, /usr/local/sbin/quadrante-tunel status` (modo 440, validado com `visudo -cf` antes de mover).

- [ ] **Passo 1: Escrever `scripts/teste-quadrante-tunel.sh`** (roda no host com Docker; contêiner `debian:12` como root, com `systemctl` **falso** no PATH que registra os argumentos, e usuário `quadrante` + sudoers instalados como o `install.sh` faz). Verificações: `ligar` com token válido (60 caracteres `A-Za-z0-9`) cria `/etc/quadrante/cloudflared.env` modo 600 com `TUNNEL_TOKEN=` e o `systemctl` falso recebeu `enable --now quadrante-cloudflared`; tokens inválidos (com espaço, `;rm -rf`, 10 caracteres, vazio) saem com `2` e **não** criam o arquivo; `ligar` com duas linhas no stdin usa só a primeira ou recusa (nunca executa a segunda); `desligar` chama `disable --now`; `status` imprime `ativo`/`inativo`; argumento desconhecido → `2`; `visudo -cf /etc/sudoers.d/quadrante` OK; `su -s /bin/bash quadrante -c 'sudo -n /usr/local/sbin/quadrante-tunel status'` funciona e `su -s /bin/bash quadrante -c 'sudo -n /bin/ls'` **falha**.
- [ ] **Passo 2:** `bash scripts/teste-quadrante-tunel.sh` → FALHA.
- [ ] **Passo 3: Implementar** o auxiliar, a unidade e a nova etapa do `install.sh`.
- [ ] **Passo 4:** teste → todas `OK`; reexecutar `bash scripts/teste-instalador.sh` (a instalação completa continua passando, e agora o instalador também deixa `cloudflared` e o sudoers).
- [ ] **Passo 5: Commit:** `feat: auxiliar root do túnel e instalação do cloudflared`.

---

### Tarefa 12: Configurações — campo do túnel

**Arquivos:**
- Criar: `src/lib/auxiliarTunel.ts`, `src/app/(admin)/configuracoes/actionsTunel.ts`, `src/app/(admin)/configuracoes/TunelCloudflare.tsx`
- Modificar: `src/app/(admin)/configuracoes/page.tsx` (seção `#acesso` e link no menu `nav`), `src/lib/protecao-paginas.test.ts`
- Teste: `src/lib/auxiliarTunel.test.ts`

**Interfaces:**
- Consome: `criarEAtivarTunel` (Tarefa 10); `setEnvValue` (Tarefa 2); `requireRole` (`src/lib/auth.ts`).
- Produz: `chamarAuxiliar(sub: "ligar" | "desligar" | "status", stdin?: string, base?: string[]): Promise<string>` — `spawn` **sem shell** de `base` (padrão `["sudo", "-n", "/usr/local/sbin/quadrante-tunel"]`) + `sub`; o `stdin` vai pelo fluxo, nunca por argumento; saída ≠ 0 → `Error` em português.
- Produz: `lerStatusTunel(): Promise<{ disponivel: boolean; ativo: boolean }>` (`disponivel: false` se o auxiliar não existe/`sudo` falha).
- Produz (`actionsTunel.ts`, `"use server"`, cada função começa com `await requireRole("SUPER")`): `ligarTunelAction(_prev: unknown, fd: FormData): Promise<{ erro?: string; ok?: string; confirmar?: { tipo: string; conteudo: string } }>` (campos `tokenApi`, `hostname`, `confirmar`; usa `criarEAtivarTunel` com `ligar = (t) => chamarAuxiliar("ligar", t + "\n")`; ao OK grava `TUNEL_HOSTNAME` com `setEnvValue`), `desligarTunelAction(): Promise<{ erro?: string }>`.
- Produz (UI cliente): campo do token (`type="password"`, `autoComplete="off"`), campo do endereço, lista das permissões exigidas (Conta › Cloudflare Tunnel › Editar; Zona › DNS › Editar), aviso quando `location.protocol === "http:"` ("o token trafega sem criptografia nesta rede; faça numa rede confiável"), aviso do domínio de `GOOGLE_REDIRECT_URI`, etapa de confirmação mostrando o registro DNS atual com o botão "Trocar para este servidor", status (ligado + endereço / desligado) e botão "Desligar túnel". Sem o auxiliar: "Auxiliar do túnel não instalado (rode o install.sh)".

- [ ] **Passo 1: Testes que falham.** `auxiliarTunel.test.ts` com um script falso em pasta temporária como `base`: o `stdin` chega ao script e **não** aparece nos argumentos; saída ≠ 0 rejeita com mensagem em português; `status` devolve a saída aparada. Em `protecao-paginas.test.ts` acrescentar:
```ts
test("toda server action de actionsTunel.ts confere requireRole(\"SUPER\")", () => {
  // conta `export async function` e `requireRole("SUPER")` no arquivo (sem comentários): iguais e > 0
});
```
- [ ] **Passo 2:** `npx tsx --test src/lib/auxiliarTunel.test.ts src/lib/protecao-paginas.test.ts` → FALHA.
- [ ] **Passo 3: Implementar** (ler `page.md` se tocar em `searchParams`; seguir o estilo dos outros componentes de Configurações).
- [ ] **Passo 4:** testes → PASSAM; `npx tsc --noEmit` e `npm run lint` limpos.
- [ ] **Passo 5: Commit:** `feat: ligar o túnel Cloudflare pelas Configurações`.

---

### Tarefa 13: Documentação e verificação final

**Arquivos:**
- Modificar: `README.md` (seções "Instalação do zero", "Variáveis de ambiente" e "Restaurar o servidor completo")

- [ ] **Passo 1: Reescrever o README:** "Instalação do zero" vira o comando `curl … | sudo bash` + o uso da tela `/restaurar` + o botão "Acesso pela internet"; "Restaurar o servidor completo" vira o **roteiro de virada** do spec (backup fresco e teste de restauração no antigo → instalar → restaurar → conferir pela rede local → ligar o túnel confirmando a troca do DNS → só então desligar o antigo); incluir na tabela de variáveis `BACKUP_PASSPHRASE`, `RESTAURACAO_CODIGO` e `TUNEL_HOSTNAME`; manter o aviso sobre guardar a `BACKUP_PASSPHRASE` no cofre.
- [ ] **Passo 2: Verificação completa:** `npm test` (todos passam), `npx tsc --noEmit`, `npm run lint`, `bash scripts/teste-instalador.sh`, `bash scripts/teste-quadrante-tunel.sh` — todos sem falhas. Conferir `git status` limpo, e que `prisma/quadrante.db` e o `.env` de produção **não** mudaram (`git diff --stat main` não lista nada fora do escopo).
- [ ] **Passo 3: Commit:** `docs: instalação, restauração e virada de servidor`.
- [ ] **Passo 4: Aceitação do dono (não é feita pelo agente):** no servidor novo, rodar o `install.sh`, enviar o backup **real** do Drive em `/restaurar`, conferir login e totais, e só então ligar o túnel num endereço de teste antes do de produção.
