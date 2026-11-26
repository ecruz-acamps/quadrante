# Alta disponibilidade ativo-passivo (etapa 1: troca manual assistida)

Data: 2026-11-26 · Situação: **proposta para revisão do dono** (nada implementado).

## Por que

Hoje o Quadrante roda num servidor só. Se ele cair (defeito, queda de luz ou de internet no local), o sistema fica
fora do ar por horas: é preciso reinstalar noutra máquina e restaurar o **backup diário**, perdendo até 24 h de dados.
Durante um acampamento isso é inaceitável.

O dono tem um **segundo servidor em outro local**, com outra internet. O servidor 1 (ativo) já está ligado por **VPN
(cliente FortiClient, que continua como está)** ao firewall do local do servidor 2, com **tráfego transparente nos dois
sentidos**.

Sucesso = se o servidor ativo cair, em **~5 minutos** o outro assume com **no máximo ~1 segundo** de dados perdidos,
sem reinstalar nada, e ninguém precisa entrar de novo no sistema.

## Objetivos

1. **Réplica contínua do banco** do ativo para a reserva, com atraso de ~1 s.
2. **Promoção da reserva em um comando** (`promover`): ela assume o banco, o sistema e o endereço público.
3. **Aviso no celular** quando o ativo parar de responder, com a instrução do que fazer.
4. **Nunca dois ativos ao mesmo tempo** ("cérebro dividido"), nem depois de uma queda de energia no meio da noite.
5. **Volta planejada** (`voltar`) para o servidor original, quando o dono quiser.
6. Os dois servidores sempre **na mesma versão** do sistema.
7. **Software aberto** em tudo o que for instalado para a alta disponibilidade.

## Não objetivos (desta etapa)

- **Troca automática** sem uma pessoa decidir: fica para a etapa 2, que exige um terceiro voto (seção "Etapa 2").
- Mexer na VPN: o **FortiClient permanece** e é mantido pelo dono; aqui ele é só uma premissa.
- Ativo-ativo (os dois atendendo ao mesmo tempo): o SQLite não foi feito para isso.
- Trocar o SQLite por outro banco.

## Premissas (conferir antes de implementar)

| Premissa | Situação |
|---|---|
| VPN do servidor 1 ao firewall do servidor 2 | **existe** (FortiClient) |
| Tráfego transparente nos dois sentidos pela VPN | **confirmado pelo dono** |
| Cada servidor alcança o outro sempre pelo **mesmo IP** | conferir (IP fixo do servidor 1 na VPN) |
| A VPN **reconecta sozinha** depois de queda de internet e de reinício do servidor 1, sem pedir código (MFA) | conferir |
| SSH (porta 22) aberto entre os dois pela VPN | conferir |
| Mesmo túnel Cloudflare usado pelos dois (o token fica em `/etc/quadrante/cloudflared.env`) | a configurar |

Se a VPN não reconectar sozinha, a réplica para enquanto ela estiver caída. **Os dados não se perdem**: o Litestream
retoma de onde parou. Mas a reserva fica desatualizada nesse intervalo, e o vigia (seção 5) avisa também disso.

## Visão geral

```
      usuários ──► quadrante.movimentocampista.com.br (Cloudflare)
                                    │
                    túnel: ligado SÓ no servidor ativo
                 ┌──────────────────┴───────────────────┐
         [SERVIDOR 1] papel = ativo             [SERVIDOR 2] papel = reserva
         Quadrante (pm2) + cloudflared          Quadrante parado, cloudflared parado
         Litestream ── SFTP pela VPN ────────►  réplica do banco (~1 s)
         backup diário (cron)                   vigia: testa o 1 a cada 30 s
                                                `promover` → assume em ~2 min
```

## Desenho

### 1. Papel de cada servidor

Arquivo `/etc/quadrante/papel`, com `ativo` ou `reserva`. É a fonte da verdade de cada máquina, e tudo o mais o
consulta:

- **ativo:** Quadrante no pm2, `cloudflared` ligado, Litestream replicando, backup diário e alarme de silêncio no cron.
- **reserva:** Quadrante **parado**, `cloudflared` **parado**, Litestream recebendo a réplica, vigia ligado.

### 2. Réplica do banco (Litestream, Apache 2.0)

- No ativo, `litestream replicate` acompanha `prisma/quadrante.db` e envia cada mudança por **SFTP**, pela VPN, para
  `/var/lib/quadrante/replica` na reserva. Intervalo de envio de 1 s (`sync-interval: 1s`).
- Usuário de sistema dedicado com chave SSH só para isso, restrito ao SFTP nessa pasta (`ForceCommand internal-sftp`
  e `ChrootDirectory`).
- Na promoção, a reserva faz `litestream restore` **da pasta local**. Os dados já estão na máquina que assume e não
  dependem do servidor que caiu.
- **Mudança no sistema:** o SQLite precisa ficar em **modo WAL**, que o Litestream exige, com `busy_timeout`. Hoje
  o banco usa o modo padrão (journal). A mudança é feita ao conectar, em `src/lib/db.ts` (`PRAGMA journal_mode=WAL`
  e `PRAGMA busy_timeout=5000`). O snapshot do backup (`VACUUM INTO`) e a restauração já lidam com WAL.

### 3. Endereço público (túnel Cloudflare)

- Os dois servidores têm o `cloudflared` instalado com o **mesmo token de túnel**. Só o ativo o mantém ligado.
- Promover = ligar o `cloudflared` da reserva. Em segundos a Cloudflare passa a mandar os acessos para ela. **Não muda
  DNS.**
- O serviço `quadrante-cloudflared` deixa de iniciar sozinho no boot e passa a ser ligado pelo script de papel
  (seção 6).

### 4. Comandos de troca

Scripts em `scripts/ha/`, rodando como root, que registram tudo em `/var/log/quadrante/ha.log`:

- **`promover`** (na reserva):
  1. confirma que o outro servidor **não responde** como ativo: pede o papel dele pela VPN e testa o endereço
     público. Se o outro ainda estiver ativo, **recusa**, salvo com `--forcar` e confirmação digitada;
  2. `litestream restore` da réplica local para `prisma/quadrante.db`;
  3. `prisma migrate deploy` (não faz nada se as versões batem);
  4. papel = `ativo`, sobe o Quadrante (pm2), liga o `cloudflared` e o Litestream (agora replicando **para o outro
     servidor**) e liga o cron;
  5. avisa no celular: "Servidor 2 assumiu às HH:MM."
- **`rebaixar`** (no ativo, para manutenção ou volta planejada): para o túnel, o Quadrante, o Litestream e o cron;
  papel = `reserva`.
- **`voltar`** (volta planejada, com os dois no ar): `rebaixar` no ativo atual, espera a réplica alcançar (o
  Litestream confirma a última posição) e `promover` no outro. Fica fora do ar ~1 min.

### 5. Vigia (na reserva)

Um timer do systemd a cada **30 s**:

- testa o ativo pela VPN (`/api/saude`) e pelo endereço público;
- **3 minutos** seguidos sem resposta: **aviso no celular** (Pushbird/web push que já existem): "Servidor 1 fora do ar
  há 3 min. Para assumir: rode `sudo promover` no servidor 2." Repete a cada 15 min;
- réplica parada há mais de 5 min (a VPN caiu, por exemplo) com o ativo no ar: aviso "réplica atrasada";
- **não promove sozinho** (etapa 1).

**Mudança no sistema:** nova rota `/api/saude`, sem login, que responde `{"ok": true}` se o banco responde. Não expõe
dados.

### 6. Regra de boot ("ninguém volta sozinho como ativo")

O boot de um servidor nunca liga túnel nem sistema às cegas. Um serviço `quadrante-papel` roda no boot e:

- **papel gravado = reserva:** fica reserva;
- **papel gravado = ativo:** pergunta pela VPN qual é o papel do outro servidor:
  - o outro responde **reserva**: volta como ativo, como depois de uma queda de luz rápida;
  - o outro responde **ativo**: alguém promoveu o outro enquanto este estava fora. Fica **reserva** e passa a receber
    a réplica;
  - o outro **não responde**: não dá para saber se ele foi promovido. Fica **reserva** e avisa no celular: "Servidor 1
    voltou, mas não alcança o servidor 2. Confira e rode `promover` no servidor certo."

Com isso, uma máquina que volta sozinha no meio da noite **nunca** cria dois ativos.

### 7. Cron e atualização do sistema

- O backup diário e o alarme de silêncio ficam no cron dos dois servidores, mas cada linha só age se
  `/etc/quadrante/papel` = `ativo`.
- **Atualizar o sistema** (o botão em Configurações, no ativo): ao terminar, dispara a mesma atualização na reserva pela
  VPN (`git pull` e `build`). Na reserva o script **não roda migrações**, porque o banco dela é a réplica. O selo de
  versão em Configurações mostra a versão **dos dois** e avisa se estiverem diferentes.

### 8. Segredos e configurações

- `AUTH_SECRET`, `BACKUP_PASSPHRASE` e `DATABASE_URL`: **iguais nos dois** `.env`, copiados uma vez na instalação da
  reserva. Com o mesmo `AUTH_SECRET`, **as sessões continuam válidas** depois da troca.
- **Configurações gravadas pela tela no `.env`** (a aba Microsoft: `ENTRA_*`): passam a ficar **no banco**, que é
  replicado. O `.env` continua aceito como valor inicial. Assim a reserva assume já com o segredo do Entra certo.
- `TUNEL_HOSTNAME` e `COOKIE_SECURE`: escritos pelo script de papel conforme o papel.
- Arquivos (fichas, comprovantes): já ficam **no OneDrive**, fora dos servidores. Nada a replicar.

### 9. Instalação da reserva

O `install.sh` ganha um modo `QUADRANTE_PAPEL=reserva`:

- instala o mesmo que hoje, mais Litestream, os scripts de `scripts/ha/` e os serviços `quadrante-papel` e
  `quadrante-vigia`;
- não sobe o sistema nem o túnel e grava o papel `reserva`;
- recebe por parâmetros o IP do outro servidor, a chave SSH da réplica e o `.env` copiado do ativo.

No ativo, um comando `ha-configurar` liga a réplica para o IP da reserva e grava o papel `ativo`. A primeira cópia do
banco é um snapshot completo, que o Litestream faz sozinho.

## Software

| Peça | Para quê | Licença |
|---|---|---|
| Litestream | réplica contínua do SQLite | Apache 2.0 |
| OpenSSH (SFTP) | transporte da réplica | BSD |
| systemd (timers e serviços) | vigia e papel no boot | LGPL |
| pm2 | manter o Quadrante no ar | MIT (já usado) |
| cloudflared | túnel do endereço público | Apache 2.0 (já usado) |
| FortiClient | VPN entre os locais | da Fortinet, **mantido pelo dono, fora do escopo** |

## Roteiro de testes de falha (antes de considerar pronto)

Tudo feito primeiro num par de máquinas de teste e depois nos servidores reais, fora de época de acampamento:

1. **Réplica:** gravar uma ficha no ativo e conferir que ela aparece na réplica em ≤ 2 s (`litestream restore` numa
   pasta temporária).
2. **Desligar o ativo da tomada:** chegar o aviso em ~3 min; `promover` na reserva; o sistema abrir pelo endereço
   público com a ficha do passo 1, **sem novo login**.
3. **Religar o antigo ativo:** ele fica como reserva sozinho (o outro responde "ativo") e passa a receber a réplica.
4. **`voltar`:** o servidor original reassume, sem perda.
5. **Cortar a VPN com os dois no ar:** a reserva avisa "réplica atrasada" e **não** há dois ativos. Ao religar a VPN, a
   réplica alcança.
6. **`promover` com o ativo ainda no ar:** o comando recusa.
7. **Queda de luz nos dois e volta só do antigo ativo, sem alcançar o outro:** fica reserva e avisa.
8. **Atualizar o sistema:** os dois ficam na mesma versão e a reserva não roda migração.

## Riscos

- **VPN instável:** atrasa a réplica. Mitigação: o aviso de réplica atrasada e o Litestream retomando sozinho.
- **Promover com réplica atrasada:** perde o que não chegou. Mitigação: o `promover` mostra a idade da última mudança
  recebida e pede confirmação se passar de 1 minuto.
- **Esquecer o servidor antigo ligado como ativo durante uma falha de VPN:** coberto pela recusa do `promover` (6) e
  pela regra de boot. O caso residual é a VPN cair **e** alguém usar `--forcar`, que exige confirmação explícita.
- **Modo WAL:** muda como o SQLite grava. Precisa testar backup, restauração e atualização com WAL antes de ligar em
  produção.

## Etapa 2 (depois): troca automática

Exige **um terceiro voto** num terceiro lugar (um Raspberry Pi ou a menor VPS), porque com dois locais um não
distingue "o outro caiu" de "a ligação entre nós caiu". Os três rodam o **etcd** (Apache 2.0), que elege o ativo por
maioria. Quem perde a maioria se rebaixa sozinho; a reserva com maioria se promove sozinha. O resto desta etapa (réplica,
papel, comandos, regra de boot) é reaproveitado.

## Decisões em aberto

1. **IPs fixos** pela VPN, para os dois servidores se acharem. Qual o IP de cada um?
2. A **VPN reconecta sozinha** depois de reinício, sem MFA?
3. **Tempo para o aviso** (proposta: 3 min) e para repetir (15 min).
4. **Quem recebe os avisos:** os mesmos aparelhos do Pushbird/web push de hoje?
