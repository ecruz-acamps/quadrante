# Instalador de um comando e restauração de backup pela interface

Data: 2026-11-07 · Prazo do dono: **3 dias** (o servidor antigo deixa de existir depois da mudança).

## Por que

O dono vai trocar o Quadrante de servidor e o servidor antigo será desligado. Hoje reinstalar exige uns 15 passos
manuais (README, "Restaurar o servidor completo"): Node, pm2, clone, `.env`, descriptografar o backup com `gpg`
na mão, migrações, build, pm2, cron. O dono quer **um comando** que instale tudo e uma **tela** onde ele envia o
backup do Google Drive. O servidor novo é um **Debian 12** limpo. O dono usará o sistema só pela rede local no
começo e ligará o acesso pela internet depois, por um campo nas Configurações (túnel Cloudflare).

Sucesso = em uma máquina Debian 12 zerada, rodar um comando, abrir uma tela, enviar o `.tar.gz.gpg` baixado do Drive,
digitar a senha, e o sistema volta idêntico ao antigo (mesmos usuários, dados e logins ainda válidos).

## Objetivos

1. `install.sh` único, executável com `curl -fsSL <raw do GitHub>/install.sh | sudo bash`, que deixa o app no ar,
   iniciando sozinho no boot, com o agendamento do backup recriado.
2. Tela de restauração que recebe o arquivo de backup do Drive e a senha (`BACKUP_PASSPHRASE`) e devolve ao servidor
   o banco e o `.env`.
3. Rodar o `install.sh` de novo **atualiza** o sistema sem apagar dados nem trocar segredos.
4. Nada que o sistema precise para voltar pode ficar só no servidor antigo.
5. Acesso pela internet ligado **depois**, sem terminal: nas Configurações o dono (SUPER) cola um token da API da
   Cloudflare e o endereço público, e o sistema cria o túnel e o DNS sozinho (seção 3). O `install.sh` deixa tudo
   pronto para isso, sem ligar nenhum túnel.

**Ordem e corte (prazo de 3 dias):** instalador e restauração primeiro; o túnel é a última peça. Se o prazo
apertar, o túnel sobe à mão com `cloudflared` e a seção 3 fica para depois, sem atrasar a mudança de servidor.

## Não objetivos

- Apache, DuckDNS e abrir porta no roteador: o acesso pela internet é só pelo túnel Cloudflare (seção 3).
- Docker, painel central do sistema de pré-fichas, unificar com o outro sistema (adiado; decisão do dono).
- Backup das planilhas `.xlsx`, `fichas-export/` e `docs antigos/` (o dono já tem cópias).
- Conectar o Google Drive pela tela de restauração (o dono escolheu enviar o arquivo).
- Reescrever o Quadrante em outra tecnologia.

## Anti-objetivos (seria falha mesmo funcionando)

- Um desconhecido que achar o endereço antes do dono conseguir enviar um backup falso e tomar o sistema.
- A tela de restauração aparecer ou funcionar num sistema que já tem usuários (sobrescrever dados em uso).
- O instalador, ao rodar de novo, gerar `AUTH_SECRET` ou `BACKUP_PASSPHRASE` novos (derruba sessões ou torna
  backups antigos ilegíveis) ou apagar o banco.
- Backups agendados falhando e alertando no celular toda madrugada antes da restauração.
- O token da API da Cloudflare (poderoso: edita túneis e DNS da conta) ficar guardado no servidor, no `.env`, nos
  backups ou nos logs depois de usado.
- O usuário `quadrante` ganhar mais do que o necessário no sistema (nada de `sudo` geral): só o auxiliar do túnel.
- Trocar o DNS do endereço de produção para o servidor novo sem o dono confirmar na tela.

## Restrições

- Next.js **16** com mudanças que quebram o que se conhece: **antes de escrever qualquer código do app, ler o guia
  relevante em `node_modules/next/dist/docs/`** (regra do `AGENTS.md`). O arquivo de interceptação é `src/proxy.ts`,
  não `middleware.ts`.
- Banco SQLite via Prisma 6 (`DATABASE_URL="file:./quadrante.db"`, relativo a `prisma/`).
- Formato do backup (já existe, não mudar): `quadrante-backup-AAAA-MM-DD-HHMM.tar.gz.gpg` = `gpg` simétrico AES256
  de um `tar.gz` com `prisma/quadrante.db` (snapshot por `VACUUM INTO`) e `.env`. `src/lib/criptografia.ts`
  já tem `descriptografarArquivo(entrada, saida, senha)` (senha por stdin); `src/lib/snapshotDb.ts` já tem
  `verificarSnapshot` (integrity_check e contagem de pessoas). Reutilizar.
- O dono já mantém `scripts/backup-to-drive.ts`, `verificar-backup.ts` e `testar-restauracao.ts`; continuam valendo.
- Repositório `github.com/ecruz-acamps/quadrante` será tornado **público pelo dono** (verifiquei: sem segredos,
  bancos ou planilhas no histórico). É pré-condição do `curl | bash`. Plano B se não ficar público a tempo:
  copiar o `install.sh` por `scp` e baixar o código com um token do GitHub (`GITHUB_TOKEN`).
- Servidor de destino: Debian 12, acesso root. (O servidor atual é Debian 13: testar em contêiner ou máquina
  Debian 12 antes da virada.)

## Decisões do dono

- Um comando `.sh`; restauração **enviando o arquivo** pela interface (não conectando ao Drive).
- Acesso só pela rede local no início; túnel Cloudflare **ligado depois pelas Configurações**, com **token da API**
  (o sistema cria o túnel e o DNS), e não com o token do túnel colado do painel da Cloudflare.
- Sem Apache. Não unificar com o painel de pré-fichas. Sem Docker por ora.
- Estilo do instalador parecido com o `instalar.sh` do sistema de pré-fichas (mensagens por etapa, variáveis de
  ambiente opcionais, rodar de novo é seguro).

## Desenho

### 1. `install.sh` (raiz do repositório)

Como root, em Debian/Ubuntu. Etapas, cada uma anunciada no terminal e seguras de repetir:

1. Instala por `apt`: `git curl ca-certificates gnupg openssl tar cron`.
2. Instala **Node 22** pelo repositório NodeSource (o Node do Debian 12 é antigo) e `pm2` global.
3. Cria o usuário de sistema `quadrante` (sem login), dono da pasta do app e de `/var/log/quadrante`.
4. Baixa o código em `/opt/quadrante` (`QUADRANTE_DIR`, `QUADRANTE_BRANCH`, `QUADRANTE_REPO` configuráveis);
   se já existir, `git pull`.
5. Se **não** existir `.env`: cria um mínimo com `DATABASE_URL`, `AUTH_SECRET` (gerado com `openssl rand -hex 32`)
   e o **código de restauração** (`RESTAURACAO_CODIGO`, aleatório, uso único). Se existir `.env`: não toca.
6. `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run build`. Em atualização, copia antes o
   banco para `prisma/quadrante.db.bak-antes-deploy-AAAAMMDD`.
7. Sobe com `pm2` usando `ecosystem.config.cjs` (corrigir `cwd` fixo para `__dirname`), `pm2 save` e
   `pm2 startup systemd` para o usuário `quadrante`.
8. Recria o cron do usuário `quadrante` (backup 03:00 e alarme de silêncio 09:00, com `PATH` do Node de sistema),
   **só quando houver `BACKUP_PASSPHRASE` no `.env`** (guarda na própria linha do cron), para não alertar o celular
   antes da restauração.
9. Instala o `cloudflared` (repositório apt da Cloudflare) **sem ligar nenhum túnel**, e o auxiliar
   `/usr/local/sbin/quadrante-tunel` (dono root) com uma regra em `/etc/sudoers.d/quadrante` que permite ao usuário
   `quadrante` rodar **somente** esse script, sem senha.
10. Mensagem final: endereço `http://<IP>:3008/restaurar` (rede local), o código de uso único e o próximo passo
    ("depois de restaurar, ligue o acesso pela internet em Configurações").

### 2. Tela `/restaurar`

- **Quando existe:** somente se a tabela `Usuario` está vazia. Com qualquer usuário cadastrado, a rota responde
  404 e a API recusa. A checagem acontece em **toda** requisição (não só ao abrir a tela).
- Em sistema vazio, `src/proxy.ts` leva quem abrir o sistema para `/restaurar` em vez do login.
- **Proteção:** exige o código de uso único impresso pelo instalador; limite de tentativas (ex.: 5, depois
  bloqueio por alguns minutos) para impedir adivinhação.
- **Fluxo "Restaurar backup":** o usuário envia o `.tar.gz.gpg` (o banco tem ~2,4 MB; aceitar até ~200 MB),
  digita a senha (`BACKUP_PASSPHRASE`). O servidor descriptografa em pasta temporária, extrai, valida o
  banco com `verificarSnapshot` (aborta se reprovar ou se não houver pessoas), troca `prisma/quadrante.db` e `.env`
  de forma atômica, aplica `prisma migrate deploy` (o backup pode ser de um esquema mais antigo) e reinicia o
  processo (sair com sucesso para o `pm2` subir de novo, relendo `.env` e banco). Em erro, nada é substituído e a
  tela mostra o motivo em português (senha errada, arquivo corrompido, banco reprovado).
- **Fluxo "Começar do zero":** pede e-mail e senha e cria o usuário SUPER (substitui o `prisma/seed.ts` com senha
  aleatória). Também exige o código.
- Depois de qualquer fluxo o código deixa de valer (o `.env` restaurado não o tem; no "do zero" ele é removido).
- Após restaurar, os logins continuam válidos porque o `AUTH_SECRET` vem do backup.

### 3. Túnel Cloudflare pelas Configurações (só perfil SUPER)

Por padrão o sistema responde só na rede local (`http://<IP>:3008`). Em Configurações, um bloco
"Acesso pela internet (Cloudflare)":

- **Campos:** token da API da Cloudflare e endereço público (ex.: `quadrante.movimentocampista.com.br`). A tela
  lista as permissões que o token precisa: Conta › Cloudflare Tunnel › Editar; Zona › DNS › Editar (mais leitura
  de conta e zona para localizar o domínio).
- **"Criar túnel":** o servidor, pela API da Cloudflare, valida o token, localiza a conta e a zona do domínio,
  cria o túnel, define a rota `endereço → http://localhost:3008`, cria (ou atualiza) o registro DNS CNAME para
  `<id>.cfargotunnel.com` com proxy, obtém o token do túnel e o entrega ao auxiliar `quadrante-tunel` (por stdin),
  que instala e inicia o serviço `cloudflared`.
- **Endereço que já aponta para outro túnel** (caso do servidor antigo): a tela mostra o registro atual e exige
  confirmação explícita antes de trocar. É essa troca que passa o acesso para o servidor novo.
- **Token da API usado uma vez e descartado:** não vai a disco, `.env`, backup nem log. Só o token do túnel
  permanece, com o serviço do `cloudflared` (arquivo do systemd legível só por root). Para recriar, o dono cola
  o token de novo.
- **Status e desligar:** mostra ligado/desligado e o endereço; "Desligar túnel" para o serviço (não apaga nada na
  Cloudflare).
- **Auxiliar `quadrante-tunel`:** único comando que o usuário `quadrante` roda como root; subcomandos `ligar`
  (token do túnel por stdin), `desligar` e `status`; valida toda entrada e nunca executa texto recebido.
- **Avisos na tela:** (a) se aberta por HTTP, o token da API trafega sem criptografia na rede local: fazer em
  rede confiável; (b) se o endereço novo diferir do domínio de `GOOGLE_REDIRECT_URI`/`GOOGLE_DRIVE_REDIRECT_URI`,
  lembrar de atualizar o `.env` e o Google Cloud.

### 4. Roteiro de virada (vai para o README)

1. No servidor antigo: rodar o backup agora (`scripts/backup-to-drive.ts`) e o teste de restauração; guardar a
   `BACKUP_PASSPHRASE` no cofre de senhas.
2. No novo: rodar o `install.sh`; abrir `/restaurar`; enviar o backup mais recente do Drive.
3. Conferir pela rede local: login, totais do Quadrante, e rodar o backup manual uma vez.
4. Em Configurações, ligar o acesso pela internet com o token da API, no mesmo endereço de hoje (senão atualizar
   `*_REDIRECT_URI` no `.env` e no Google Cloud), confirmando a troca do DNS que aponta para o servidor antigo.
   Conferir o acesso de fora da rede.
5. Só então desligar o servidor antigo.

## Deixado ao construtor

- Nomes de arquivos, estrutura de rotas e componentes da tela; textos em português.
- Como reiniciar o processo (saída com código 0 e `pm2` com `autorestart`, ou chamada ao `pm2`).
- Como impedir corrida na troca do arquivo do banco com o Prisma ainda conectado (desconectar antes).
- Limites exatos de tentativas e de tamanho de upload.

## Chamadas minhas (o dono pode reverter)

- Usuário de sistema `quadrante` em `/opt/quadrante`, em vez de `root` em `/home/true/...`.
- Node 22 via NodeSource (não `nvm`).
- Código de restauração de uso único, impresso no terminal.
- Cron instalado só depois de existir `BACKUP_PASSPHRASE`.
- Aviso (não mudança) no instalador se o fuso do servidor não for `America/Sao_Paulo`.
- O token da API é descartado após criar o túnel (não é guardado), e a troca de um DNS já existente exige
  confirmação na tela.

## Testes

- `install.sh`: executar do zero e uma segunda vez (idempotência) em Debian 12; conferir `pm2`, reinício do
  servidor, cron e que `.env`/banco/segredos não mudam na repetição.
- Restauração: usar o backup real do Drive num servidor de teste (porta diferente, nunca na produção): senha
  errada, arquivo truncado, arquivo de outro formato, código errado, sistema já com usuário (deve recusar).
- Testes automatizados (`npm test`, `tsx --test`) para a lógica pura: checagem "sem usuários", limite de tentativas,
  validação do backup, e a montagem das chamadas à API da Cloudflare (com a API simulada, sem tocar na conta real).
- Túnel: testar uma vez de verdade com um endereço de teste (subdomínio descartável), nunca o de produção; conferir
  que o token da API não aparece em arquivo, log nem `.env`; que o usuário `quadrante` não roda outro comando via
  `sudo`; que o auxiliar recusa entradas inválidas.
