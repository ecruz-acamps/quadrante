# Bloqueio de servo ativo em missões próximas (< 3 meses)

## Objetivo

Quando duas missões estão ativas ao mesmo tempo (ex: um FAC e um Sênior) e a data de uma está a menos de 3 meses da outra, um servo que já está ATIVO em uma delas não deve poder ser cadastrado como ATIVO na outra sem uma liberação explícita da coordenação geral.

## Escopo

- Verificação roda ao criar ou editar um Servo (`criarServo`, `atualizarServo`, `adicionarServoRapido`), sempre que o status resultante for `ATIVO`.
- A verificação só é aplicada entre missões que tenham data preenchida. Missões sem data são ignoradas (não bloqueiam nada) — isso cobre as 21 missões históricas importadas, que não têm essa informação e não precisam ser preenchidas retroativamente.
- Quando há conflito, o cadastro é bloqueado a menos que um código de liberação válido, gerado a pedido de um usuário SUPER (coordenação geral) e enviado via push (Pushbird), seja informado.
- Fora de escopo: telas de duplicatas, importação em massa, e qualquer verificação sobre Neocampista/fichas.
- O campo `ano` de edição (ex: 22°, 23°) da missão **não muda** — continua sendo o número sequencial que já existe hoje. A nova data é um campo separado, só para esta checagem.

## Schema (`prisma/schema.prisma`)

```prisma
model Missao {
  ...
  mes           Int?    // mês da missão (1-12), opcional
  anoCalendario Int?    // ano-calendário real (ex: 2026), opcional — não confundir com o "ano" de edição existente
  ...
}

// código de liberação temporário para cadastrar servo em missão em conflito
model LiberacaoConflitoServo {
  id        Int      @id @default(autoincrement())
  pessoaId  Int
  missaoId  Int      // missão de destino onde o servo está sendo cadastrado
  codigo    String   // 6 dígitos
  criadoEm  DateTime @default(now())
  expiraEm  DateTime
  usado     Boolean  @default(false)

  pessoa Pessoa @relation(fields: [pessoaId], references: [id])
  missao Missao @relation(fields: [missaoId], references: [id])
}
```

Migration via `npx prisma migrate dev`.

`mes` e `anoCalendario` juntos formam a "data" da missão para efeito desta regra — ambos opcionais e independentes de `ano` (edição).

## Edição de missão (pré-requisito, não existe hoje)

Hoje `/missoes` só permite criar, ativar e excluir — não editar. Para preencher/ajustar `mes`/`anoCalendario` (inclusive depois de criada a missão), adiciono:
- Os dois campos (`mes` como `<select>` 1-12, `anoCalendario` como `<input type="number">`) no formulário de "Nova missão" (`criarMissao`).
- Uma nova ação `atualizarMissao(prevState, formData)` (SUPER) e um link "Editar" por missão em `/missoes` levando a `/missoes/[id]`, formulário simples reaproveitando os mesmos campos (nome, tipo, ano de edição, mês, anoCalendario, cercoSlug, valores) — mesmo padrão da página `[id]` de servo.

## Helper de conflito (`src/lib/actions.ts` ou novo `src/lib/conflitoServo.ts`)

```ts
async function checarConflitoServo(pessoaId: number, missaoDestinoId: number) {
  const destino = await db.missao.findUniqueOrThrow({ where: { id: missaoDestinoId } });
  if (destino.mes == null || destino.anoCalendario == null) return null;

  const outros = await db.servo.findMany({
    where: { pessoaId, status: "ATIVO", missaoId: { not: missaoDestinoId } },
    include: { missao: true },
  });

  for (const s of outros) {
    const m = s.missao;
    if (m.mes == null || m.anoCalendario == null) continue;
    const distancia =
      Math.abs((destino.anoCalendario - m.anoCalendario) * 12 + (destino.mes - m.mes));
    if (distancia < 3) {
      return { missaoConflito: m, distancia };
    }
  }
  return null;
}
```

## Fluxo de bloqueio + liberação

- `criarServo`/`atualizarServo` passam a ter assinatura `(_prevState: unknown, formData: FormData)` (como `loginAction`), retornando `{ error }`, `{ conflito: { missaoNome, distancia } }` ou redirecionando/revalidando em caso de sucesso.
- Antes de salvar, se o status for `ATIVO`, chama `checarConflitoServo`. Se houver conflito:
  - Se o form não trouxer um campo `codigoLiberacao` válido → retorna `{ conflito: { pessoaId, missaoConflito: { id, nome }, distancia } }` (sem salvar).
  - Se trouxer `codigoLiberacao` → valida contra `LiberacaoConflitoServo` (existe, `pessoaId`+`missaoId` batem, não expirado, não usado). Se válido, marca `usado: true` e prossegue salvando normalmente. Se inválido/expirado, retorna `{ error: "Código de liberação inválido ou expirado." }`.
- Nova action `solicitarLiberacaoConflito(pessoaId: number, missaoId: number, missaoConflitoNome: string)`:
  - Gera código de 6 dígitos aleatório, cria `LiberacaoConflitoServo` com `expiraEm = now + 15 min`.
  - Chama `notificarPushbird` com título tipo "Liberação de servo pendente" e mensagem citando nome da pessoa e as duas missões, incluindo o código.
  - Retorna `{ ok: true }` (o código não volta pro browser — só quem recebe o push tem o código, que a coordenação repassa verbalmente/por mensagem para quem está cadastrando).

## UI

- `ServoForm.tsx` continua igual; `novo/page.tsx` e `[id]/page.tsx` passam a usar um novo client wrapper (`ServoFormClient`, no padrão `useActionState` já usado em `login/page.tsx`) que:
  - Recebe `ServoForm` como `children` (server component passado como prop).
  - Mostra `state.error` se houver.
  - Se `state.conflito` existir: mostra aviso ("Fulano já é servo ativo em {missão}, a {distancia} mês(es) de distância") + botão "Solicitar liberação da coordenação" (chama `solicitarLiberacaoConflito`) + campo para digitar o código recebido, reenviado no próximo submit do mesmo form.
- `AdicionarServoModal.tsx`: já tem `erro`/`enviando` state manual. Estendo `adicionarServoRapido` para retornar o mesmo formato `{ conflito }`, e adiciono no modal a mesma UI de "solicitar liberação" + campo de código antes de tentar de novo.

## Teste manual

1. Criar duas missões com data (mês/anoCalendario) a menos de 3 meses de distância (ex: FAC mês 3/2026, Sênior mês 5/2026).
2. Cadastrar um servo ATIVO na primeira.
3. Tentar cadastrar a mesma pessoa como servo ATIVO na segunda → deve bloquear e mostrar o aviso de conflito com o nome da outra missão.
4. Clicar "Solicitar liberação" → um usuário SUPER deve receber o push com o código.
5. Digitar o código no formulário e salvar → servo é criado normalmente.
6. Tentar reusar o mesmo código numa segunda tentativa → deve falhar ("expirado ou já usado").
7. Repetir o cadastro com uma missão sem data preenchida → não deve bloquear (comportamento de missões históricas preservado).
8. Cadastrar em `AdicionarServoModal` (quick-add) com o mesmo cenário de conflito → mesmo comportamento de bloqueio/liberação.
