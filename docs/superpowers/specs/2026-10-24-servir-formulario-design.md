# Candidatos a servir — formulário público por missão

Data: 2026-10-24 · Status: aguardando aprovação do dono

Substitui o desenho da agenda com app (guardado em `2026-10-24-agenda-servir-app-ADIADO-design.md`) e atualiza a spec de 2026-10-10, que ficou fora do repositório.

## Por que

A cada missão, a disponibilidade dos servos é coletada num Google Forms ("Você gostaria de trabalhar nos acampamentos?") e o coordenador monta as equipes lendo as respostas, na mão, fora do Quadrante.

Este recurso troca o Forms por uma **página pública por missão**, parecida com o Forms. As respostas viram **candidatos** numa tela de triagem no Quadrante. Aprovar um candidato o coloca como servo da missão, num setor.

Sucesso = o admin abre a triagem, vê quem se disponibilizou para a missão, sabe se a pessoa já tem histórico e aprova ou recusa sem copiar dados de planilha.

## Objetivos

- Página pública `/servir/[slug]` por missão, sem login, no visual do Cerco de Jericó, que funciona bem no celular.
- Triagem no Quadrante com histórico da pessoa e aprovação para um setor.
- O admin **personaliza as perguntas** do formulário numa tela de configuração. O conjunto de perguntas é um só e vale para todas as missões.
- Nada muda no que já existe em produção.

## Fora do escopo

- App, agenda de missões, login por CPF, Excel de elegíveis e regra do Casais (guardados no desenho adiado).
- Inscrição para **fazer** o acampamento e integração com o sistema de pré-fichas.
- Importar respostas antigas do Google Forms.
- Edição das respostas pelo próprio candidato, e-mail ou WhatsApp de retorno.
- Visão de coordenador só do próprio setor.

## Anti-objetivos

- A página pública devolver dados já gravados de alguém. Ela só aceita envio e responde "recebido".
- Duplicar candidato quando a mesma pessoa responde duas vezes.
- Mexer em `Servo` ou `Pessoa` sem o admin aprovar.

## Restrições

- O Quadrante roda em produção (pm2 + Apache + Cloudflare tunnel). Migração **aditiva** e com backup do `prisma/quadrante.db`. Só entra em produção quando o dono mandar "liberar" (mensagem dele, nunca de agente).
- Esta versão do Next.js tem mudanças que quebram o que se conhece. `AGENTS.md` manda ler `node_modules/next/dist/docs/` antes de escrever código.
- Testes no padrão do repositório (`node:test`, `src/lib/testdb.ts`); `protecao-paginas.test.ts` continua verde.

## Fatos conferidos (2026-10-24)

- **Forms real (planilha de respostas):** 265 respostas e 254 CPFs diferentes, ou seja, cerca de 11 pessoas responderam mais de uma vez. Isso confirma o upsert por `(missaoId, cpf)`. O Forms hoje aceita erros de digitação ("c" em vez de Sim/Não, "SIM" em vez de "Sim", paróquia escrita de 97 jeitos, um CPF em branco). Perguntas de escolha com lista fechada, validação de CPF e a opção "Outra" resolvem a maior parte.
- A pergunta "Você fez o Acampamento Sênior…" é de escolha única: guarda só um acampamento por pessoa.

- Só 102 de 3.358 `Pessoa` têm CPF real; o resto é `000.000.000-00` ou vazio. A ligação candidato→pessoa compara só os dígitos e só vale para CPF real. Sem CPF real, procura por nome e nascimento (ver Aprovar).
- `Pessoa.aniversario` é texto livre sem ano (ex.: `19/mai`). Não dá para comparar com a data de nascimento completa do formulário.
- Existem as tabelas `Setor` (16 nomes), `Nucleo` e `Paroquia`. `Paroquia` é um mapa cidade+bairro→paróquia, **não** uma lista de paróquias.
- Moldes no código: `inscreverCerco` e a página `cerco/[slug]` (página pública, limite de envio, aviso Pushbird), `checarConflitoServo` e `adicionarServoRapido` (criar servo), `autorizacao.ts` (acesso à missão).
- `Missao.cercoSlug` é único e já é usado como endereço público.

## Página pública `/servir/[slug]`

- `slug` = `Missao.cercoSlug`. Fica fora do grupo `(admin)`.
- Se `servirPublicado` for falso: "Inscrições encerradas no momento".
- Campos **fixos** (não editáveis, a triagem depende deles), nesta ordem:
  1. Nome completo (obrigatório)
  2. CPF (obrigatório, valida dígitos verificadores)
  3. Celular (obrigatório)
  4. "Você é casado(a)?" Sim/Não (obrigatório). Se **Sim**, aparecem e passam a ser obrigatórios: **nome do cônjuge** e **celular do cônjuge**.
- Em seguida, as **perguntas personalizadas** ativas, na ordem definida pelo admin (ver "Perguntas personalizáveis").
- Por último, o campo fixo "Você pode servir no {Missao.nome}{ - servirDatas}?" Sim/Não (obrigatório).
- Aceite obrigatório do texto de LGPD copiado do Forms (a Associação dos Campistas São Padre Pio guarda os dados para equipes futuras, sem compartilhar). O texto vive na página.
- Aviso fixo: responder não garante vaga na equipe.
- Quem responde "Não" também é gravado.
- Proteção contra abuso: `excedeuLimite("servir:envio:" + ip, 10, 10 min)`, como no Cerco.

## Dados

Modelo novo `Candidato`:

| Campo | Tipo | Nota |
|---|---|---|
| id | Int PK | |
| missaoId | Int FK Missao | |
| nome, celular | String | |
| cpf | String | só dígitos |
| casado | Boolean | |
| conjugeNome, conjugeCelular | String? | preenchidos só se `casado`; celular só com dígitos |
| respostas | String | JSON: lista de `{perguntaId, titulo, tipo, valor}`. O título e o tipo são copiados no momento do envio, para a resposta continuar fazendo sentido se a pergunta mudar depois |
| disponivel | Boolean | |
| status | String | `PENDENTE` \| `APROVADO` \| `RECUSADO`, padrão `PENDENTE` |
| servoId | Int? | preenchido ao aprovar |
| criadoEm / atualizadoEm | DateTime | |

- `@@unique([missaoId, cpf])`: reenviar com o mesmo CPF **atualiza** a linha (upsert). O status volta a `PENDENTE` só se ainda não estava `APROVADO`.
- `@@index([missaoId, status])`.

`Missao` ganha `servirPublicado Boolean @default(false)` (nasce fechado) e `servirDatas String?`.

O CPF fica em texto puro, como em `Pessoa.cpf`. A lista de candidatos fica atrás do login.

Modelo novo `PerguntaServir` (conjunto único, vale para todas as missões):

| Campo | Tipo | Nota |
|---|---|---|
| id | Int PK | |
| ordem | Int | posição no formulário |
| titulo | String | texto da pergunta |
| tipo | String | `TEXTO_CURTO` \| `TEXTO_LONGO` \| `SIM_NAO` \| `ESCOLHA_UMA` \| `ESCOLHA_VARIAS` \| `NUMERO` \| `DATA` |
| obrigatoria | Boolean | |
| opcoes | String? | JSON: lista de opções, só para os dois tipos de escolha |
| permiteOutra | Boolean | só para escolha: aceita "Outra" com texto livre |
| ativa | Boolean | padrão verdadeiro; "excluir" na tela só desativa |

## Perguntas personalizáveis

- Tela `(admin)/configuracoes/perguntas-servir`, com `requireRole("SUPER")`. O admin cria, edita, reordena, ativa/desativa e obriga/desobriga perguntas. Para as de escolha, edita a lista de opções.
- "Excluir" desativa a pergunta: ela some do formulário, mas as respostas antigas continuam visíveis na triagem.
- Mudar o tipo de uma pergunta que já tem respostas não é permitido (cria-se outra). Mudar só o título ou as opções é permitido.
- O servidor valida cada envio contra as perguntas **ativas** naquele momento: obrigatórias preenchidas, valor do tipo certo, opção existente na lista. Resposta a pergunta desconhecida é ignorada.
- Perguntas de escolha têm a opção "permitir resposta 'Outra' em texto livre" (campo `permiteOutra` em `PerguntaServir`). A resposta guarda o texto digitado.
- Na primeira migração, o sistema cria o conjunto inicial com as perguntas do Forms real (planilha "Cadastro Servos Sênior 24", 265 respostas, lida em 2026-10-24):
  1. Data de nascimento (`DATA`, obrigatória)
  2. Você fez algum acampamento? (`SIM_NAO`)
  3. Você fez o Acampamento Sênior no Sítio São Padre Pio? Se sim, selecione qual (`ESCOLHA_UMA`, com as opções que o Forms já tem: do 1º ao 23º Sênior no Sítio, mais os de Palhoça, São José, Foronia de Santo Amaro e "Sênior geral fora do Sítio"; o admin confere a lista na tela)
  4. Quais setores você já serviu? (`ESCOLHA_VARIAS`, 23 setores mais "Nunca fui servo": Evangelização, Líder, Cozinha, Capela, Manutenção, Tropa, Cantinho Mariano, Teatro, Animação, Ligação, Música, Farmácia, Secretaria, Coordenação de Tropa/Evangelização/Líderes/Farmácia/Animação/Cozinha/Música, Auxiliar da Coordenação de Missão, Auxiliar de Líderes)
  5. Selecione a paróquia em que você serve (`ESCOLHA_UMA` com `permiteOutra`; as opções iniciais são as paróquias que mais aparecem)
  6. Participa de alguma pastoral? (`SIM_NAO`) e, se sim, qual (`TEXTO_CURTO`, opcional)
  7. Em que ano você começou a servir em sua paróquia? (`NUMERO`, opcional)
- O nome da missão e as datas do campo fixo de disponibilidade vêm de `Missao.nome` e `servirDatas`. No Forms atual essa pergunta tinha o título "24º Acampamento Sênior - 26 a 30 de dezembro", digitado à mão a cada missão.
- Não se importam as respostas antigas, só a estrutura das perguntas. A planilha tem dados pessoais e não entra no repositório.

## Triagem `/candidatos`

- Página em `(admin)/candidatos/page.tsx` com `requireUser()` dentro. Item novo no menu. Vale para a missão ativa.
- Filtros: status (padrão `PENDENTE`), disponível sim/não e busca por nome. Cada pergunta ativa de escolha (`ESCOLHA_UMA` ou `ESCOLHA_VARIAS`) também vira um filtro. Contadores no topo.
- Cada linha: nome, celular, disponibilidade, as respostas dadas (ao expandir) e **histórico confirmado** (missões e setores em que a pessoa já foi `Servo`). Se já é `Servo` nesta missão, mostra "já está no quadrante" e bloqueia aprovar.
- **Aprovar**: escolhe o setor (obrigatório) e confirma. Procura a `Pessoa` por CPF real; se não achar, mostra possíveis iguais por nome e celular e deixa o admin escolher ou criar nova. Cria o `Servo` (`INTEGRANTE`, `ATIVO`, `confirmado: false`), grava `servoId` e `APROVADO`. Roda `checarConflitoServo` e só segue com confirmação explícita se houver conflito.
- **Recusar**: `RECUSADO`, reversível.
- Candidato com `disponivel = false` não pode ser aprovado.
- Exportar xlsx, no estilo de `servos/exportar/route.ts`.
- Cada ação é uma server action com checagem de papel e acesso à missão (`autorizacao.ts`).

## Casais na triagem

Quando um candidato casado informa o cônjuge e o cônjuge também se candidata **à mesma missão**, a triagem mostra os dois ligados: "Cônjuge: {nome} (também é candidato nesta missão)" em ambas as linhas, com um atalho para o outro.

- A ligação é calculada na hora de mostrar, não gravada, então vale mesmo que o cônjuge se candidate depois ou corrija os dados.
- Dois candidatos A e B estão ligados se, em qualquer sentido, o celular do cônjuge informado por um é igual (só dígitos) ao celular do outro, **ou** o nome do cônjuge informado por um é igual ao nome do outro (sem acento e sem diferença de maiúsculas).
- Se o cônjuge ainda não se candidatou, a linha mostra "Cônjuge informado: {nome}, {celular}" sem ligação.
- Quando o celular de A bate com o de dois candidatos diferentes, nenhuma ligação é feita por celular para evitar par errado; o nome ainda é tentado.

## Configurações

Ao lado do interruptor do Cerco: toggle "Candidatos a servir" (`servirPublicado`), campo `servirDatas` e link público copiável. Mais o acesso à tela de perguntas personalizáveis.

## Notificação

Novo candidato (não reenvio) dispara `notificarPushbird` fire-and-forget, como no Cerco. Fica **fora desta primeira versão**, pois exige coluna nova em `PushbirdDevice`. Entra depois da liberação, se o dono quiser.

## Erros e casos de borda

- CPF inválido, campo vazio ou LGPD sem aceite: erro por campo, nada gravado.
- Missão inexistente ou página fechada: erro genérico, nada gravado.
- Reenvio de candidato já `APROVADO`: atualiza os dados, não mexe em status nem em `Servo`.
- Aprovar quem já é `Servo` na missão (dois admins ao mesmo tempo): a restrição `@@unique([missaoId, pessoaId])` impede; mostrar "já está no quadrante".
- Excluir missão: apaga os candidatos dela (decisão minha, ver abaixo).

## Decisões minhas (revisar)

- Nada de notificação Pushbird nem de item novo no menu até o dono liberar para uso. O teste vai numa cópia do banco.
- Aprovar procura a pessoa por nome e celular quando o CPF é zerado, e o admin confirma, para não gerar duplicata (pior caso, usar `/duplicatas`).
- Candidatos são apagados junto com a missão.
- Estado civil e dados do cônjuge são campos fixos, porque a ligação de casais depende deles. O pedido veio do dono em 2026-10-24.
- A regra de ligação do cônjuge (celular ou nome) é minha; vale só dentro da mesma missão.
- Quem pode editar perguntas e abrir a página: só SUPER (como Configurações), não ADMIN. A triagem vale para qualquer admin com acesso à missão.
- A triagem fica acessível por um link em Configurações; o item no menu lateral só entra na liberação.
- Aprovar quando há conflito de missões próximas usa o mesmo código de liberação que o Quadrante de Servos já tem (Pushbird).
- O conjunto inicial de perguntas é criado no primeiro acesso à página pública ou à tela de perguntas (não na migração).
- Nome, CPF, celular e disponibilidade são fixos. Data de nascimento virou pergunta personalizável, porque `Pessoa.aniversario` não tem ano e não serve para ligar a pessoa.
- Excluir pergunta só desativa, para não perder respostas antigas. Tipo não muda depois que há respostas.
- Os 7 tipos de pergunta acima são o conjunto inicial. Upload de arquivo, lógica condicional ("se sim, mostre...") e perguntas por missão ficam de fora.

## Testes

- Validação de CPF; upsert por `(missaoId, cpf)`; aprovar (pessoa nova, pessoa existente, duplicado, conflito); página fechada rejeita envio; `protecao-paginas.test.ts` verde.
- Perguntas: validação de cada tipo, obrigatória vazia, opção inexistente, pergunta desativada ignorada, tipo não muda se já há respostas.

## Migração e deploy

Migração Prisma aditiva: 2 tabelas (`Candidato`, `PerguntaServir`) e 2 colunas com padrão em `Missao`, mais o conjunto inicial de perguntas. Backup do `quadrante.db`, `migrate deploy`, `npm run build`, `pm2 restart quadrante`, `pm2 save`, só quando o dono mandar liberar.
