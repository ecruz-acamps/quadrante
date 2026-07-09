# Permissões de missão por usuário

## Contexto

Hoje não existe nenhum vínculo entre `Usuario` e `Missao`. O acesso é definido em
`getMissaoAtiva` (`src/lib/auth.ts`):

- **SUPER**: escolhe livremente entre todas as missões via cookie (`quadrante_missao`),
  com seletor no `AdminLayout`.
- **ADMIN**: sempre travado na missão de maior id (a mais recente cadastrada — hoje a
  missão 21), ignorando qualquer cookie.

Isso significa que todo ADMIN enxerga a missão mais nova, sem possibilidade de restringir
ou de dar acesso a uma missão diferente/antiga. O cadastro de usuário (`criarUsuario` em
`src/lib/actions.ts`, form em `usuarios/CriarUsuarioForm.tsx`) só pede nome, e-mail, senha
e role — não pede nenhuma missão.

## Objetivo

Ao criar (ou editar) um usuário ADMIN, o SUPER deve poder escolher quais missões esse
usuário pode visualizar e editar. Um ADMIN pode ter acesso a uma ou várias missões.
SUPER continua com acesso irrestrito a todas as missões, como hoje.

Dentro de uma missão vinculada, o ADMIN mantém o mesmo nível de acesso de hoje (visualiza
e edita tudo) — não há granularidade de "só visualizar" vs. "visualizar e editar" por
missão.

## Modelo de dados

Nova tabela de junção many-to-many:

```prisma
model UsuarioMissao {
  usuarioId Int
  missaoId  Int
  usuario   Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  missao    Missao  @relation(fields: [missaoId], references: [id], onDelete: Cascade)

  @@id([usuarioId, missaoId])
}
```

- `Usuario` ganha `missoes UsuarioMissao[]`.
- `Missao` ganha `usuarios UsuarioMissao[]`.
- SUPER não recebe vínculos (irrelevante para ele — sempre vê tudo).

### Migração de dados

Para todo `Usuario` com `role = "ADMIN"` já existente no banco, criar um vínculo
`UsuarioMissao` com a missão de maior `id` (a mesma que ele já enxergava antes da
mudança), preservando o comportamento atual até alguém ajustar manualmente.

## Cadastro e edição de usuário

- `CriarUsuarioForm.tsx`: adicionar uma lista de checkboxes com todas as missões
  (`db.missao.findMany({ orderBy: { id: "desc" } })`), rotulada por `nome` (+ ano/tipo se
  ajudar a diferenciar). A lista fica sempre visível no formulário (sem toggle
  condicional por role, para simplificar); se o usuário criado for SUPER, as marcações
  são ignoradas/não persistidas.
- `criarUsuario` (`src/lib/actions.ts`): ler os ids marcados (`formData.getAll("missaoIds")`)
  e, após criar o `Usuario`, criar os registros `UsuarioMissao` correspondentes (somente
  se `role === "ADMIN"`). Exigir ao menos uma missão marcada quando `role === "ADMIN"` —
  erro de validação se nenhuma for selecionada.
- **Novo**: formulário/ação de edição de usuário existente, hoje inexistente (só há
  criar e excluir em `usuarios/page.tsx`). Precisa permitir:
  - Alterar nome, role.
  - Alterar as missões vinculadas (mesmo componente de checkboxes, pré-marcado com o
    vínculo atual).
  - Trocar a senha é opcional/fora de escopo — pode ficar como "deixe em branco para
    manter a senha atual" se for simples de fazer, mas o essencial deste projeto é a
    edição das missões vinculadas.
  - Nova server action `atualizarUsuario`, protegida por `requireRole("SUPER")`, que
    sincroniza `UsuarioMissao` (apaga os vínculos antigos e recria com a nova seleção,
    dentro de uma transação).
- `usuarios/page.tsx`: listar, junto de cada usuário, as missões vinculadas (ou "todas"
  para SUPER) e um link/botão para editar.

## Lógica de acesso (`getMissaoAtiva`)

- **SUPER**: sem mudança — cookie + todas as missões.
- **ADMIN**:
  - Buscar as missões vinculadas via `UsuarioMissao` (join com `Missao`).
  - Se o cookie `quadrante_missao` aponta para uma missão vinculada, usar essa.
  - Caso contrário (sem cookie, ou cookie aponta para missão não vinculada), cair na
    missão vinculada de maior id.
  - Se o usuário não tiver nenhuma missão vinculada (caso raro/erro de cadastro),
    `getMissaoAtiva` retorna `null` e as páginas que dependem de missão devem tratar
    isso como "sem acesso" (mensagem apropriada em vez de erro).

## Layout (`AdminLayout`)

- O seletor de missão (hoje só para `isSuper`) passa a aparecer também para ADMIN
  quando ele tiver mais de uma missão vinculada.
- Lista de opções do `<select>`: SUPER vê todas as missões; ADMIN vê apenas as
  vinculadas a ele.
- Se ADMIN tiver só uma missão vinculada, mantém o comportamento atual (texto simples,
  sem seletor).

## Fora de escopo

- Granularidade "só visualizar" vs. "visualizar e editar" por missão.
- Qualquer alteração ao comportamento de SUPER.
- Troca de senha na tela de edição de usuário, se não for trivial de encaixar (pode ser
  adiada para um ajuste futuro, desde que a edição de missões vinculadas funcione).
