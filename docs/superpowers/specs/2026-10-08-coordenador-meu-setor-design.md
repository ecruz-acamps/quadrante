# Perfil COORDENADOR: acesso restrito ao próprio setor

Data: 2026-10-08 · Status: aguardando revisão

## Objetivo

Cada coordenador entra no sistema com um login próprio e vê apenas os servos do setor dele (o coordenador da tropa não vê a secretaria). Nessa tela ele registra, por servo, se a pessoa deu **sim**, **não** ou **desistiu**. Ele não altera mais nada.

## Decisões já tomadas

- Permissão: ver os servos do setor e marcar o status de cada um. Nenhuma outra edição.
- Cada coordenador tem **exatamente um setor** e uma ou mais missões.
- O acesso é criado manualmente por um SUPER em `/usuarios`. Não há criação automática.
- Abordagem: perfil novo, **bloqueado por padrão**. Todo o sistema atual recusa o coordenador, e só uma página nova (`/meu-setor`) e uma ação nova o aceitam.

## Por que bloqueado por padrão

Hoje o sistema só tem SUPER e ADMIN, ambos de confiança, e a autenticação é feita pelo layout `(admin)`. O layout do Next não é uma barreira segura: na navegação entre páginas ele nem sempre roda de novo, e uma requisição direta a uma página ou rota (inclusive `?_rsc=`) pode não passar por ele. Levantamento feito em 2026-10-08:

- 15 páginas e rotas do `(admin)` não chamam `requireUser` nem `requireRole`: `(admin)/page.tsx`, `cidades`, `formacao`, `cerco-dashboard` (e `cerco-dashboard/exportar`), `registros`, `fichas`, `fichas/novo`, `fichas/[id]`, `tribos`, `camisetas`, `financeiro`, `setores`, `servos/novo`, `servos/[id]`. (Além dessas, as duas rotas `api/auth/google*` também não chamam, mas são o login e ficam fora.)
- Em `src/lib/actions.ts` há 39 ações exportadas. Quase todas chamam `requireUser`; `loginAction`, `logoutAction`, `sugerirNomesCerco` e `inscreverCerco` são públicas de propósito.

Sem mudança, um coordenador logado abriria `/servos/22248` ou `/financeiro` direto pela URL. O desenho faz o contrário: se algo for esquecido, o coordenador não vê nada.

## Dados

- `Usuario.role` passa a aceitar `COORDENADOR` (hoje `SUPER | ADMIN`).
- `Usuario.setor String?`: nome do setor, preenchido só para `COORDENADOR`. O nome do setor é a chave usada em `Servo.setor`, então não há tabela nova.
- A missão do coordenador continua vindo de `UsuarioMissao`.
- Migração aditiva (uma coluna nova, nullable). Backup do banco antes de aplicar, no padrão `prisma/quadrante.db.bak-antes-<nome>`.

## Autorização (`src/lib/auth.ts`)

- `requireUser()` passa a redirecionar `COORDENADOR` para `/meu-setor`. Em ações, redirecionar encerra a execução sem gravar.
- `getMissaoAtiva()` devolve `null` para `COORDENADOR`, como se não houvesse missão. Páginas atuais mostram "Nenhuma missão ativa" em vez de dados.
- `requireRole("SUPER")` continua igual.
- Nova `requireQualquerUsuario()`: exige login e aceita qualquer perfil. Usada pelo layout e por `requireCoordenador()`; é o corpo antigo de `requireUser()`.
- Nova `requireCoordenador()`: exige `role === "COORDENADOR"` (outro perfil volta para `/`). Devolve `{ usuario, setor, missao, missaoIds }`. **Não redireciona** quando faltam setor ou missão (evita loop de redirecionamento): `setor` e `missao` vêm `null`, a página mostra o aviso de cadastro incompleto e a ação `marcarStatusServo` recusa. É a **única** função que aceita esse perfil, usada só por `/meu-setor` e pela ação nova.
- A missão do coordenador é a **mais recente entre as vinculadas** em `UsuarioMissao`. Não há seletor de missão para ele.
- As 15 páginas e rotas sem checagem própria ganham `await requireUser()` na primeira linha. Assim a proteção não depende do layout.
- `(admin)/layout.tsx`: para `COORDENADOR`, menu reduzido a **Meu setor** e **Sair**, sem seletor de missão do admin.

## Tela `/meu-setor`

Página nova em `src/app/(admin)/meu-setor/`.

- Lista os servos da missão ativa do coordenador cujo `Servo.setor` é o dele. Mostra todos os status, para ele ver quem já respondeu e corrigir um engano.
- Colunas: nome, função, celular, camiseta, status.
- Status em três botões: **Sim** (`ATIVO`), **Não** (`RECUSOU`), **Desistiu** (`DESISTIU`). Os dois últimos abrem um campo de motivo opcional, no mesmo estilo do modal de falta da Formação.
- Sem links para a ficha da pessoa, histórico, busca global, exportação nem outros setores.
- Se o coordenador não tiver setor ou missão, mostra uma mensagem pedindo ao administrador que complete o cadastro.

## Ação `marcarStatusServo(servoId, status, motivo?)`

Em `src/lib/actions.ts`.

1. `requireCoordenador()`.
2. Carrega o servo. Se não existir, ou se `servo.setor !== setor` do coordenador, ou se `servo.missaoId` não estiver entre as missões dele, devolve erro e **não grava**.
3. `status` precisa ser `ATIVO | RECUSOU | DESISTIU`; qualquer outro valor é rejeitado.
4. Grava só `status` e o motivo correspondente (`motivoRecusou` ou `motivoDesistiu`), limpando o do status anterior ao voltar para `ATIVO`.
5. `revalidatePath("/meu-setor")`, `/servos` e `/registros`.

A ação não recebe campos livres, então não serve para editar outros dados.

## Criação do acesso

- `criarUsuario` e `atualizarUsuario` (hoje transformam qualquer role diferente de SUPER em ADMIN) passam a aceitar `COORDENADOR`.
- Para `COORDENADOR`: setor obrigatório, validado contra a tabela `Setor`, e ao menos uma missão (grava em `UsuarioMissao`).
- `CriarUsuarioForm` e `EditarUsuarioForm` ganham a opção "Coordenador" com seletor de setor. Ao trocar o perfil de COORDENADOR para outro, o setor é limpo.
- Após o login, o coordenador cai em `/meu-setor`.

## Testes

Cobertura automatizada das regras de acesso (o projeto ainda não tem testes; a primeira tarefa do plano é montar a infraestrutura mínima):

- `requireCoordenador`: recusa quem não é coordenador, sem setor ou sem missão.
- `marcarStatusServo`: aceita servo do próprio setor e missão; recusa outro setor, outra missão, status inválido e servo inexistente; não altera outros campos.
- `requireUser` e `getMissaoAtiva` com `COORDENADOR`: redireciona e devolve `null`.
- Varredura: nenhuma página ou rota sob `(admin)`, fora `meu-setor`, fica sem chamada a `requireUser` ou `requireRole`.

Verificação manual: criar um usuário coordenador de teste, abrir por URL direta páginas de outro setor, `/financeiro`, `/fichas`, `/servos/<id>` e `/cerco-dashboard/exportar`, e confirmar redirecionamento. Depois remover o usuário de teste.

## Fora do escopo

Coordenador com mais de um setor, criação automática de logins, edição de dados além do status, notificações, e tela de pagamento ou formação para o coordenador.

## Riscos

- Ações públicas e a rota de login com Google não dependem de `requireUser`; não mudam.
- O login com Google (`api/auth/google/callback`) deve continuar respeitando o `role` gravado; conferir na implementação que ele nunca promove ou troca o perfil de um coordenador.
- Se o setor for renomeado em `/setores`, o coordenador perde o vínculo até o administrador reatribuir. Aceito para a primeira versão.
