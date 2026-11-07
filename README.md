# Quadrante — Movimento Campista

Sistema web interno para organizar os **acampamentos** (missões) do Movimento Campista: quem serve em cada
setor, quem são os neocampistas (fichas), pagamentos, camisetas, tribos, o "Cerco de Jericó" (escala de
oração 24h) e o histórico de cada pessoa ao longo das edições.

Produção: `https://quadrante.movimentocampista.com.br` (acesso restrito a quem tem conta).

> **Importante:** o código está neste repositório, mas **os dados não**. O banco (`prisma/quadrante.db`) e o
> arquivo `.env` ficam de fora do git de propósito. Para reinstalar o sistema você precisa dos dois — veja
> [Backup e recuperação](#backup-e-recuperação).

---

## Sumário

1. [Para que serve](#para-que-serve)
2. [Módulos do sistema](#módulos-do-sistema)
3. [Roteiro (o que vem por aí)](#roteiro-o-que-vem-por-aí)
4. [Tecnologias](#tecnologias)
5. [Estrutura do projeto](#estrutura-do-projeto)
6. [Instalação do zero](#instalação-do-zero) (um comando, restauração pela interface, túnel Cloudflare)
7. [Variáveis de ambiente (.env)](#variáveis-de-ambiente-env)
8. [Rodando em desenvolvimento](#rodando-em-desenvolvimento)
9. [Publicando em produção](#publicando-em-produção)
10. [Backup e recuperação](#backup-e-recuperação)
11. [Mudar de servidor / restaurar o servidor completo](#mudar-de-servidor--restaurar-o-servidor-completo)
12. [Operação do dia a dia](#operação-do-dia-a-dia)
13. [Solução de problemas](#solução-de-problemas)

---

## Para que serve

Cada acampamento é uma **missão** (ex.: "23º Acampamento Sênior"). O sistema responde, para a missão ativa:

- **Quem está servindo e em qual setor** (Animação, Cantinho Mariano, Música, Teatro, Cozinha…), com função
  (Coordenador, Auxiliar, Apoio, Integrante), camiseta, horário do Cerco e se pagou.
- **Quem são os campistas novos** (neocampistas), com ficha, núcleo, cidade, pagamento e tribo.
- **Quanto foi arrecadado**, quem falta pagar, quem desistiu ou recusou e por quê.
- **Quantas vezes cada pessoa já serviu** e em quais setores (com alerta de servir muitas vezes seguidas no
  mesmo setor).
- **Quem cobre cada hora do Cerco de Jericó**, com inscrição pública por link.
- **Quem se disponibilizou para servir** na próxima missão, por formulário público (substitui o Google Forms), com triagem e aprovação para um setor.

O sistema guarda **todas as edições** num mesmo banco, então o histórico de uma pessoa (como campista e como
servo) atravessa os acampamentos.

## Módulos do sistema

Itens do menu lateral do painel administrativo:

| Módulo | O que faz |
|---|---|
| **Início** | Resumo da missão ativa: totais, pagamentos, vagas do Cerco e alertas. |
| **Quadrante de Servos** | Tela principal. Servos agrupados por setor em cards recolhíveis; edição inline de função, camiseta, cerco e pagamento; adicionar, editar, excluir, marcar "disse não"/"desistiu"; filtros por nome e setor; exportação para Excel; **comparar com outra edição** (painel lateral com arrastar-e-soltar para trazer pessoas para um setor); **Chamar Evangelização**. |
| **Inscrição de servos** | Formulário público `/servir/<slug>` (mesmo apelido do Cerco, fechado até o SUPER abrir) para quem quer servir na missão. Nome, CPF, celular, estado civil (casado informa nome e celular do cônjuge) e "você pode servir?" são fixos; as demais perguntas (nascimento, acampamentos feitos, setores já servidos, paróquia, pastoral…) são **editáveis** pelo SUPER: criar, reordenar, desativar, obrigatória ou opcional, 7 tipos (texto curto/longo, sim/não, escolha uma/várias, número, data) e opção "Outra". Um conjunto de perguntas vale para todas as missões. A triagem lista os candidatos com filtros, respostas, **cônjuges ligados** quando os dois se candidatam à mesma missão, pessoas parecidas já cadastradas e aprovação para um setor (cria o servo; respeita o bloqueio de missões próximas com o código de liberação). Exporta para Excel. |
| **Formação** | Presença nas formações e motivo de falta de cada servo. |
| **Cerco de Jericó** | Dashboard das vagas por horário e inscrição pública por link (`/cerco/<slug>`), com notificação no celular a cada inscrição. A página pública funciona como PWA (com tela offline). |
| **Camisetas** | Contagem por tamanho para o pedido. |
| **Por Setor / Por Cidade** | Visões agregadas da missão. |
| **Fichas (Neocampistas)** | Cadastro dos campistas novos, com alertas de possíveis duplicatas entre fichas. |
| **Tribos** | Divisão dos neocampistas em tribos e seus líderes. |
| **Evangelização** (v1.2) | Equipes de 3 (com carro) formadas pelas cidades dos servos, sorteio de 3 a 4 casas de neocampistas por equipe sem nunca mandar a equipe à cidade de um membro, tela de cidades/vizinhança, fechar a distribuição (só o SUPER reabre) e folhas de impressão por equipe. |
| **Financeiro** | Valores por categoria (interna, externa, campista), pagos e pendentes. |
| **Não / Desistências / Faltas** | Quem recusou, desistiu ou faltou, com motivo. |
| **Pessoas** | Cadastro único de pessoas e histórico de missões de cada uma. |
| **Estatísticas** | Números gerais e comparativos entre edições. |
| **Possíveis Duplicatas** | Detecta pessoas cadastradas duas vezes; permite ignorar falsos positivos. |
| **Missões** | Cria e edita acampamentos (tipo, ano, valores, link do Cerco, mês). |
| **Usuários** | Contas do sistema e quais missões cada uma enxerga. |
| **Configurações** | Liga/desliga o Cerco público, cadastra aparelhos de notificação (Pushbird) e concentra os **backups** (download do banco, do `.env` e conexão com o Google Drive). |

### Perfis de acesso

- **SUPER**: enxerga todas as missões; gerencia usuários, backup e configurações.
- **ADMIN**: enxerga apenas as missões liberadas para ele (tabela `UsuarioMissao`).

### Regras de negócio relevantes

- Uma pessoa não pode servir em missões muito próximas no calendário; o sistema bloqueia e permite pedir
  liberação por código de 6 dígitos (`LiberacaoConflitoServo`).
- Servir mais de 2 vezes seguidas no mesmo setor gera alerta (exceto Diretor Espiritual).
- O Cerco tem 24 faixas de uma hora (`HORARIOS_CERCO` em `src/lib/constants.ts`).
- Inscrição de servos: um candidato por (missão, CPF); reenviar o formulário com o mesmo CPF atualiza a resposta em vez de duplicar (candidato já aprovado continua aprovado). A página pública nunca devolve dados gravados e limita 10 envios por IP a cada 10 minutos. Excluir uma pergunta só a desativa, para preservar respostas antigas; o tipo não muda depois que há respostas.
- Casais na triagem: dois candidatos da mesma missão são ligados se o celular (ou o nome) do cônjuge informado por um bate com o do outro; celular repetido em dois candidatos não liga ninguém.

## Roteiro (o que vem por aí)

Nada desta lista está em produção. Cada item tem spec e/ou plano em `docs/superpowers/`. A **Inscrição de servos** já saiu da lista: está em produção desde 2026-10-24 (spec e plano em `docs/superpowers/`).

| Item | Situação |
|---|---|
| **v1.2: Evangelização** (equipes de visita e sorteio das casas dos neocampistas por cidade) | Implementada e testada, **ainda não publicada em produção** (a migração do banco já foi aplicada, é só acréscimo). Falta conferir a tabela de vizinhança entre cidades (rascunho em `scripts/seed-cidades.ts`). Equipes de 3 pessoas (com carro), 3 a 4 casas por equipe, e uma equipe nunca visita a cidade de um dos seus membros. |
| **Coordenador em `/meu-setor`** (login que só enxerga o próprio setor) | Adiado; spec e plano prontos. |
| **Agenda de servir em app Android** (CPF + lista de quem já fez o acampamento, agenda das próximas missões, Capacitor) e **inscrição para fazer o acampamento** integrada ao sistema de pré-fichas por API | Adiado; desenho guardado em `docs/superpowers/specs/2026-10-24-agenda-servir-app-ADIADO-design.md`. |

## Tecnologias

- **Next.js 16** (App Router, Server Components e Server Actions) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **Prisma 6** com **SQLite** (um único arquivo de banco)
- **ExcelJS** para exportação de planilhas
- **bcryptjs** para senhas; sessão por cookie assinado (HMAC), invalidável via `Usuario.sessaoVersao`
- Login por senha **ou Google** (restrito ao domínio da organização)
- Google Drive API para backup; Pushbird para notificações no celular
- **PM2** para manter o processo no ar

> Esta versão do Next.js tem mudanças em relação ao que muitos tutoriais mostram. Antes de alterar convenções
> do framework, leia a documentação em `node_modules/next/dist/docs/` (veja `AGENTS.md`).

## Estrutura do projeto

```
prisma/
  schema.prisma            modelo de dados
  migrations/              migrações versionadas (aplicar com migrate deploy)
  seed.ts                  cria o usuário administrador inicial
  quadrante.db             BANCO DE DADOS (fora do git)
scripts/                   importação de planilhas, normalização de nomes e backup para o Drive
src/
  app/
    login/                 tela de login
    (admin)/               painel autenticado (servos, fichas, tribos, financeiro, ...)
    cerco/[slug]/          inscrição pública do Cerco (PWA)
    servir/[slug]/         formulário público de inscrição de servos
    api/auth, api/backup   login Google e backup/Drive
  lib/
    actions.ts             Server Actions (toda a escrita no banco)
    actionsServir.ts       Server Actions da inscrição de servos (envio público, perguntas, triagem)
    servir*.ts, cpf.ts     regras da inscrição de servos (validação, perguntas, candidatos, cônjuges), com testes
    auth.ts                sessão, perfis e missão ativa
    db.ts                  cliente Prisma
    constants.ts           funções, camisetas, horários do Cerco, setores
docs/                      planos e notas de desenho
```

## Instalação do zero

### Servidor: um comando

Num **Debian 12** (ou Ubuntu) limpo, como administrador:

```bash
curl -fsSL https://raw.githubusercontent.com/ecruz-acamps/quadrante/main/install.sh | sudo bash
```

O instalador instala o que falta (Node 22, pm2, git, gpg, cron), cria o usuário `quadrante`, baixa o código em
`/opt/quadrante`, monta o `.env` mínimo, aplica as migrações, faz o build, sobe o sistema na **porta 4008** (volta
sozinho após reiniciar a máquina) e recria o agendamento dos backups. Também deixa o `cloudflared` e um auxiliar
prontos para o acesso pela internet, **sem ligar nenhum túnel**. No fim ele mostra o endereço
`http://<IP>:4008/restaurar` e um **código de restauração** (uso único).

**Rodar de novo atualiza** o sistema: não troca `AUTH_SECRET`/`BACKUP_PASSPHRASE` nem apaga o banco (antes de atualizar
ele guarda uma cópia em `prisma/quadrante.db.bak-antes-deploy-AAAAMMDD`). Variáveis opcionais: `QUADRANTE_DIR`,
`QUADRANTE_REPO`, `QUADRANTE_BRANCH`.

### Primeiro acesso: restaurar o backup pela interface

1. Abra `http://<IP>:4008/restaurar` (rede local). Em sistema recém-instalado, o login leva para essa tela.
2. Baixe do Google Drive o `quadrante-backup-….tar.gz.gpg` mais recente e envie na tela, com o **código de restauração**
   e a **senha do backup** (`BACKUP_PASSPHRASE`, do seu cofre de senhas).
3. O sistema descriptografa, confere o banco, troca banco e `.env`, aplica as migrações e reinicia sozinho. Em qualquer
   erro (senha errada, arquivo danificado, banco reprovado, migração que falha) nada é substituído. Depois abre o login
   normal, com os mesmos usuários e logins.

Sem backup, o bloco **Começar do zero** cria o primeiro administrador. A tela `/restaurar` só existe enquanto não há
nenhum usuário cadastrado (depois responde 404) e erra o código no máximo 5 vezes em 15 minutos.

> Na rede local o acesso é por HTTP, então o instalador grava `COOKIE_SECURE="false"` no `.env` (sem isso o navegador
> descarta o cookie de login) e a restauração preserva essa linha. Ao ligar o túnel (abaixo) ela é removida.

### Acesso pela internet (túnel Cloudflare)

Depois de restaurar, entre como administrador (perfil SUPER) em **Configurações › Acesso pela internet**:

1. Crie na Cloudflare um **token de API** com as permissões *Conta › Cloudflare Tunnel › Editar*, *Zona › DNS › Editar*
   e *Zona › Zona › Leitura* (o token de conta `cfat_…` ou de usuário servem).
2. Cole o token e o **endereço público** (ex.: `quadrante.movimentocampista.com.br`) e clique em **Criar túnel**.
   O sistema cria o túnel, a rota para `localhost:4008` e o registro DNS, e liga o serviço `cloudflared`.
3. Se o endereço **já aponta para outro lugar** (o servidor antigo), a tela mostra o registro atual e pede confirmação
   antes de trocar: é essa troca que passa o acesso para o servidor novo.

O token da API é usado uma vez e **não é guardado** (nem em disco, `.env`, backup ou log); só o token do túnel
fica, em `/etc/quadrante/cloudflared.env` (modo 600, só root). Depois de ligar, use o endereço `https://`. **Desligar túnel**
para o serviço e volta a permitir HTTP na rede local. Abra o token numa rede em que você confie: na rede local ele
trafega por HTTP.

### Para desenvolvimento

```bash
git clone https://github.com/ecruz-acamps/quadrante.git
cd quadrante
npm ci
nano .env                       # veja a seção abaixo; copie o de um backup se tiver
npx prisma migrate deploy       # cria as tabelas (ou aplica as pendentes)
SEED_ADMIN_PASSWORD='uma-senha-forte' npx tsx prisma/seed.ts   # só em banco novo e vazio
npx prisma generate
npm run dev                     # http://localhost:3005
```

Em um banco novo, o usuário criado é `admin@quadrante.local` (perfil SUPER).

## Variáveis de ambiente (.env)

Crie `.env` na raiz do projeto. **Nunca o envie ao git** (já está no `.gitignore`).

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `DATABASE_URL` | sim | `file:./quadrante.db` (caminho relativo à pasta `prisma/`). |
| `AUTH_SECRET` | sim | Segredo que assina os cookies de sessão. Gere com `openssl rand -hex 32`. **Se mudar, todos precisam logar de novo.** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | para login Google | Credenciais OAuth criadas no Google Cloud Console. |
| `GOOGLE_REDIRECT_URI` | para login Google | `https://SEU-DOMINIO/api/auth/google/callback`. Precisa estar cadastrada idêntica no Google Cloud. |
| `GSUITE_DOMAIN` | para login Google | Só e-mails desse domínio entram. |
| `GOOGLE_DRIVE_REDIRECT_URI` | para backup | `https://SEU-DOMINIO/api/backup/drive/callback`. |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | para backup | Preenchido sozinho ao conectar o Drive em Configurações. |
| `GOOGLE_DRIVE_FOLDER_ID` | para backup | ID da pasta do Drive que recebe os backups. |
| `PUSHBIRD_WEBHOOK_URL` | opcional | Webhook que envia notificação ao celular quando alguém se inscreve no Cerco. |
| `COOKIE_SECURE` | opcional | `false` permite acessar por HTTP em rede local (o instalador grava; ligar o túnel remove). Padrão: seguro em produção. |
| `BACKUP_PASSPHRASE` | para backup | Senha do backup criptografado (16+ caracteres; `openssl rand -base64 33`). **Guarde no cofre de senhas, fora do servidor.** |
| `RESTAURACAO_CODIGO` | só na instalação | Código de uso único da tela `/restaurar`; o instalador gera e ele some depois de restaurar. |
| `TUNEL_HOSTNAME` | automática | Endereço público do túnel, preenchido ao ligar o túnel em Configurações. |
| `SEED_ADMIN_PASSWORD` | opcional | Senha do admin criado pelo seed (senão é gerada aleatoriamente). |

Se mudar de domínio, atualize os dois `*_REDIRECT_URI` **no `.env` e no Google Cloud Console**.

## Rodando em desenvolvimento

```bash
npm run dev        # http://localhost:3005
npm run lint
npx tsc --noEmit   # checagem de tipos
```

**Cuidado:** o app usa o `DATABASE_URL` do `.env`. Para testar escrita (adicionar, excluir, arrastar),
trabalhe numa **cópia** do banco, nunca no de produção.

## Publicando em produção

Primeira vez (o `install.sh` já faz tudo isto; use só se preferir manual):

```bash
npm ci
npx prisma generate
npx prisma migrate deploy     # aplica migrações pendentes (faça backup do banco antes!)
npm run build
pm2 start ecosystem.config.cjs                  # escuta na porta 4008
pm2 save && pm2 startup                          # volta sozinho após reiniciar a máquina
```

Atualizações:

```bash
git pull
cp prisma/quadrante.db prisma/quadrante.db.bak-antes-deploy-$(date +%Y%m%d)
npm ci && npx prisma generate && npx prisma migrate deploy
npm run build
pm2 restart quadrante
```

Aponte seu proxy reverso/túnel (Cloudflare Tunnel, Nginx, Caddy…) para `http://localhost:4008` com HTTPS.

## Backup e recuperação

O que **só existe no servidor** (não está no GitHub):

| Item | Por que importa |
|---|---|
| `prisma/quadrante.db` | Todos os dados: servos, pessoas, fichas, pagamentos, histórico. **Insubstituível.** |
| `.env` | Segredos. Sem `AUTH_SECRET` e as credenciais Google, o login não funciona. |

### Backup manual

Em **Configurações** (como SUPER) há um link para baixar o banco (`/api/backup`), gerado como snapshot
consistente (`VACUUM INTO`) e verificado antes do download. Faça isso antes de mudanças grandes. O `.env`
**não** é mais baixável pela aplicação: ele segue dentro do backup criptografado do Drive e deve ter uma
cópia no seu cofre de senhas.

### Backup automático para o Google Drive (diário, criptografado)

O script `scripts/backup-to-drive.ts` roda **todo dia às 03:00** e:

1. tira um snapshot consistente do banco (`VACUUM INTO`) e confere `PRAGMA integrity_check`;
2. compacta o snapshot + `.env` e **criptografa com gpg (AES256)**; a senha é `BACKUP_PASSPHRASE`, no `.env`;
3. envia `quadrante-backup-AAAA-MM-DD-HHMM.tar.gz.gpg` ao Drive, confere o tamanho e mantém as **45 cópias mais recentes**;
4. grava `/var/log/quadrante/ultimo-backup-ok`. Se algo falhar, manda **alerta no celular** (Pushbird) e sai com erro.

Sem `BACKUP_PASSPHRASE` o script se recusa a enviar (nunca sobe backup sem criptografia).

> ⚠️ **Guarde a `BACKUP_PASSPHRASE` no seu cofre de senhas, fora do servidor.** Sem ela, nenhum backup do Drive
> pode ser aberto, nem por você: se o servidor morrer, a senha que estava no `.env` morre junto.

Configuração:

1. Em **Configurações**, clique em **Conectar Google Drive** (grava o refresh token no `.env`).
2. Garanta a senha no `.env` (`BACKUP_PASSPHRASE="..."`, 16+ caracteres; gere com `openssl rand -base64 33`).
3. Teste manualmente:
   ```bash
   npx tsx scripts/backup-to-drive.ts
   ```
4. **Agende.** O `install.sh` já cria este agendamento para o usuário `quadrante` (as linhas só agem depois que o `.env` tem a
   `BACKUP_PASSPHRASE`). Para fazer à mão, use `crontab -e`. O segundo item é o alarme de silêncio: avisa no celular se não há backup bom há mais de 26 h
   (cobre o caso de o cron ou o servidor nem rodarem o backup):
   ```cron
   0 3 * * * export PATH=/caminho/do/node/bin:/usr/bin:/bin; cd /caminho/para/quadrante && ./node_modules/.bin/tsx scripts/backup-to-drive.ts >> /var/log/quadrante/backup.log 2>&1
   0 9 * * * export PATH=/caminho/do/node/bin:/usr/bin:/bin; cd /caminho/para/quadrante && ./node_modules/.bin/tsx scripts/verificar-backup.ts >> /var/log/quadrante/backup.log 2>&1
   ```

**Teste de restauração** (antes de cada evento e a cada poucos meses): baixa o backup mais recente do Drive,
descriptografa, extrai numa pasta temporária e confere o banco, sem tocar na produção:

```bash
npx tsx scripts/testar-restauracao.ts      # termina com "RESTAURAÇÃO OK."
```

> O agendamento (cron) vive no servidor, não no repositório: ao trocar de máquina, recrie-o. O cron não enxerga
> o `node` do nvm sem o `export PATH`.

## Mudar de servidor / restaurar o servidor completo

Roteiro para trocar de máquina (ou recuperar o sistema depois de perder o servidor, tendo o GitHub e o backup do Drive):

1. **No servidor antigo (se ainda existir):** rode um backup agora (`npx tsx scripts/backup-to-drive.ts`) e o teste de
   restauração (`npx tsx scripts/testar-restauracao.ts`, deve terminar com "RESTAURAÇÃO OK."). Confirme que a
   `BACKUP_PASSPHRASE` está no seu cofre de senhas.
2. **No servidor novo:** rode o `install.sh` (comando acima).
3. Abra `http://<IP>:4008/restaurar`, envie o backup mais recente do Drive e a senha (seção "Primeiro acesso").
4. **Confira pela rede local:** login, totais do Quadrante de Servos, e rode o backup manual uma vez
   (`cd /opt/quadrante && sudo -u quadrante ./node_modules/.bin/tsx scripts/backup-to-drive.ts`). Se o Google Drive pedir
   para reconectar, use Configurações › Conectar Google Drive.
5. **Ligue o acesso pela internet** em Configurações, no mesmo endereço de hoje, confirmando a troca do DNS que aponta
   para o servidor antigo (se o domínio mudar, atualize os `*_REDIRECT_URI` no `.env` e no Google Cloud). Confira o acesso
   de fora da rede.
6. **Só então** desligue o servidor antigo.

O código do sistema vem do GitHub; **os dados** (`prisma/quadrante.db` e `.env`) vêm do backup. Sem backup do banco, o
código sobe, mas os dados estão perdidos. Cópias antigas (`prisma/quadrante.db.bak-*`) e as planilhas `.xlsx` das edições,
se ainda existirem, permitem reconstruir parte do histórico com os scripts de importação em `scripts/`
(`import-excel.ts`, `import-historico.ts`, …). Por isso o backup agendado é essencial.

### Testes do instalador (precisam de Docker)

```bash
bash scripts/teste-instalador.sh        # instala e restaura num debian:12 limpo (usa o que está commitado; ~10 min)
bash scripts/teste-quadrante-tunel.sh   # auxiliar root do túnel e regra do sudo
npx tsx scripts/gerar-backup-teste.ts /tmp/qd "senha-de-teste-123"   # backup SINTÉTICO para testar a restauração
```

## Operação do dia a dia

- **Nova missão:** menu Missões → criar (tipo, ano, valores, link do Cerco). Depois troque a missão ativa no
  seletor do topo do menu lateral.
- **Montar o quadrante:** Quadrante de Servos → **+ Novo servo**, ou **Adicionar servo** em cada setor. Para
  reaproveitar a equipe anterior, use **Comparar com outra edição** e arraste os nomes para os setores.
- **Exportar:** **Exportar Excel** no Quadrante (missão ativa); o dashboard do Cerco também exporta a escala.
- **Usuários:** menu Usuários; perfis ADMIN só veem as missões que você liberar.
- **Cerco público:** ligue/desligue em Configurações; o link é `/cerco/<slug da missão>`.

## Solução de problemas

| Sintoma | O que verificar |
|---|---|
| Ninguém consegue logar após restaurar | `AUTH_SECRET` diferente do original (todos precisam logar de novo; é normal) ou coluna `sessaoVersao` ausente: rode `npx prisma migrate deploy`. |
| Login Google dá `redirect_uri_mismatch` | `GOOGLE_REDIRECT_URI` no `.env` precisa ser idêntica à cadastrada no Google Cloud Console. |
| Volta para o login sem erro (em HTTP) | O cookie é `secure` em produção; use HTTPS ou, só em rede local, `COOKIE_SECURE=false`. |
| Erro de coluna/tabela do Prisma | Falta `npx prisma migrate deploy` e/ou `npx prisma generate`. |
| Página antiga após deploy | Rode `npm run build` antes do `pm2 restart quadrante`. |
| Porta ocupada | `ss -ltnp \| grep 4008` e `pm2 list`. |
| Logs | `pm2 logs quadrante` |
