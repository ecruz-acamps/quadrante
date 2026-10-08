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
3. [Tecnologias](#tecnologias)
4. [Estrutura do projeto](#estrutura-do-projeto)
5. [Instalação do zero](#instalação-do-zero)
6. [Variáveis de ambiente (.env)](#variáveis-de-ambiente-env)
7. [Rodando em desenvolvimento](#rodando-em-desenvolvimento)
8. [Publicando em produção](#publicando-em-produção)
9. [Backup e recuperação](#backup-e-recuperação)
10. [Restaurar o servidor completo (passo a passo)](#restaurar-o-servidor-completo-passo-a-passo)
11. [Operação do dia a dia](#operação-do-dia-a-dia)
12. [Solução de problemas](#solução-de-problemas)

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

O sistema guarda **todas as edições** num mesmo banco, então o histórico de uma pessoa (como campista e como
servo) atravessa os acampamentos.

## Módulos do sistema

Itens do menu lateral do painel administrativo:

| Módulo | O que faz |
|---|---|
| **Início** | Resumo da missão ativa: totais, pagamentos, vagas do Cerco e alertas. |
| **Quadrante de Servos** | Tela principal. Servos agrupados por setor em cards recolhíveis; edição inline de função, camiseta, cerco e pagamento; adicionar, editar, excluir, marcar "disse não"/"desistiu"; filtros por nome e setor; exportação para Excel; **comparar com outra edição** (painel lateral com arrastar-e-soltar para trazer pessoas para um setor); **Chamar Evangelização**. |
| **Formação** | Presença nas formações e motivo de falta de cada servo. |
| **Cerco de Jericó** | Dashboard das vagas por horário e inscrição pública por link (`/cerco/<slug>`), com notificação no celular a cada inscrição. A página pública funciona como PWA (com tela offline). |
| **Camisetas** | Contagem por tamanho para o pedido. |
| **Por Setor / Por Cidade** | Visões agregadas da missão. |
| **Fichas (Neocampistas)** | Cadastro dos campistas novos, com alertas de possíveis duplicatas entre fichas. |
| **Tribos** | Divisão dos neocampistas em tribos e seus líderes. |
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
    api/auth, api/backup   login Google e backup/Drive
  lib/
    actions.ts             Server Actions (toda a escrita no banco)
    auth.ts                sessão, perfis e missão ativa
    db.ts                  cliente Prisma
    constants.ts           funções, camisetas, horários do Cerco, setores
docs/                      planos e notas de desenho
```

## Instalação do zero

### Pré-requisitos

- Linux (o servidor atual é Debian), **Node.js 22** (recomendado via [nvm](https://github.com/nvm-sh/nvm)) e **npm**
- **git**
- **PM2** (`npm i -g pm2`) para produção
- Um jeito de expor a porta ao público com **HTTPS** (proxy reverso ou túnel). O cookie de sessão é `secure`
  em produção, então o acesso precisa ser por HTTPS.

### Passos

```bash
# 1. Baixar o código (repositório privado: use sua conta/token do GitHub)
git clone https://github.com/ecruz-acamps/quadrante.git
cd quadrante

# 2. Instalar dependências
npm ci

# 3. Criar o .env (veja a seção abaixo). Se tiver um backup, copie o .env dele.
nano .env

# 4. Preparar o banco
#    a) Restaurando um backup: copie o quadrante.db para prisma/quadrante.db e rode:
npx prisma migrate deploy
#    b) Banco novo e vazio: o mesmo comando cria todas as tabelas...
npx prisma migrate deploy
#       ...e depois crie o usuário administrador (se não definir a senha, ela é impressa no terminal)
SEED_ADMIN_PASSWORD='uma-senha-forte' npx tsx prisma/seed.ts

# 5. Gerar o cliente Prisma
npx prisma generate

# 6. Subir em desenvolvimento (porta 3005)
npm run dev
```

Em um banco novo, o usuário criado é `admin@quadrante.local` (perfil SUPER). Depois do primeiro login,
cadastre os **setores**, as **missões** e os demais usuários pela interface.

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
| `COOKIE_SECURE` | opcional | `false` permite acessar por HTTP em rede local. Padrão: seguro em produção. |
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

Primeira vez:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy     # aplica migrações pendentes (faça backup do banco antes!)
npm run build
pm2 start npm --name quadrante -- run start     # escuta na porta 3008
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

Aponte seu proxy reverso/túnel (Cloudflare Tunnel, Nginx, Caddy…) para `http://localhost:3008` com HTTPS.

## Backup e recuperação

O que **só existe no servidor** (não está no GitHub):

| Item | Por que importa |
|---|---|
| `prisma/quadrante.db` | Todos os dados: servos, pessoas, fichas, pagamentos, histórico. **Insubstituível.** |
| `.env` | Segredos. Sem `AUTH_SECRET` e as credenciais Google, o login não funciona. |

### Backup manual

Em **Configurações** (como SUPER) há links para baixar o banco (`/api/backup`) e o `.env`
(`/api/backup/env`). Faça isso antes de mudanças grandes.

### Backup automático para o Google Drive

O script `scripts/backup-to-drive.ts` gera `quadrante-backup-AAAA-MM-DD-HHMM.tar.gz` (contendo
`prisma/quadrante.db` e `.env`), envia para a pasta do Drive e mantém as **30 cópias mais recentes**.

1. Em **Configurações**, clique em **Conectar Google Drive** (grava o refresh token no `.env`).
2. Teste manualmente:
   ```bash
   npx tsx scripts/backup-to-drive.ts
   ```
3. **Agende.** O script foi pensado para rodar a cada 2 dias. Exemplo (`crontab -e`):
   ```cron
   0 3 */2 * * cd /caminho/para/quadrante && npx tsx scripts/backup-to-drive.ts >> /var/log/quadrante-backup.log 2>&1
   ```

> ⚠️ **Verifique se o agendamento realmente existe no servidor e se há arquivos recentes na pasta do Drive.**
> O agendamento não faz parte do repositório; um backup que nunca rodou não protege nada.

Guarde também uma cópia do `.env` num cofre de senhas, independente do Drive: o backup do Drive só é
acessível com credenciais que estão no próprio `.env`.

## Restaurar o servidor completo (passo a passo)

Cenário: o servidor foi perdido; você tem o GitHub e o backup no Drive.

1. **Máquina nova:** instale Node 22, git e PM2 (`npm i -g pm2`).
2. **Código:**
   ```bash
   git clone https://github.com/ecruz-acamps/quadrante.git && cd quadrante
   npm ci
   ```
3. **Backup:** baixe pelo navegador o `quadrante-backup-….tar.gz` mais recente da pasta do Drive e extraia
   dentro do projeto:
   ```bash
   tar -xzf /caminho/quadrante-backup-AAAA-MM-DD-HHMM.tar.gz -C .
   ```
   Isso recoloca `prisma/quadrante.db` e `.env` nos lugares certos.
4. **Banco e cliente:**
   ```bash
   npx prisma migrate deploy     # só aplica o que faltar; é seguro rodar sempre
   npx prisma generate
   ```
5. **Build e subida:**
   ```bash
   npm run build
   pm2 start npm --name quadrante -- run start
   pm2 save && pm2 startup
   ```
6. **Rede:** exponha `localhost:3008` com HTTPS no mesmo domínio (ou, se mudar de domínio, atualize os
   `*_REDIRECT_URI` no `.env` e no Google Cloud) e confira o DNS.
7. **Verificar:** faça login, abra **Quadrante de Servos** e confira se os totais batem. Reconecte o Drive
   em Configurações e **reagende o cron do backup**.

**Sem backup do banco?** O código sobe, mas os dados estão perdidos. Cópias antigas (`prisma/quadrante.db.bak-*`)
e as planilhas `.xlsx` das edições, se ainda existirem, permitem reconstruir parte do histórico com os
scripts de importação em `scripts/` (`import-excel.ts`, `import-historico.ts`, …). Por isso o backup
agendado é essencial.

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
| Porta ocupada | `ss -ltnp \| grep 3008` e `pm2 list`. |
| Logs | `pm2 logs quadrante` |
