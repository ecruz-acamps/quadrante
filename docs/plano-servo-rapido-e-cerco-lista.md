# Plano: cadastro rápido de servo + cerco em lista

## Contexto
- App Next.js 16 App Router em `/home/true/quadrante/app`. LEIA `AGENTS.md` (Next 16 tem breaking changes — consulte `node_modules/next/dist/docs/` na dúvida).
- Design system: primitivas `.card`, `.stat-card`, `.btn-primary`, `.btn-link`, `.input` em `src/app/globals.css`; paleta via CSS vars `--ink` (azul royal), `--paper`, `--brass`, `--signal` (vermelho, SÓ alerta); fontes `--font-spectral` (títulos), `--font-plex-sans`, `--font-plex-mono` (números). Não inventar cores novas.
- Mutations são server actions em `src/lib/actions.ts`. Nomes de pessoa sempre passam por `normalizarNome` de `src/lib/nomes.ts`.
- Domínio: `Pessoa` (global) ← `Servo` (pessoa × missão, único por `[missaoId, pessoaId]`) e `Neocampista` (campista/ficha por missão, SEM vínculo com Pessoa). Todo campista pode virar servo em missões futuras.

## Parte A — Adicionar servo por setor com autocomplete (admin, /servos)

Objetivo: nunca redigitar dados de quem já existe.

1. **Página `/servos`** (`src/app/(admin)/servos/page.tsx`):
   - Renderizar TODOS os setores (`db.setor.findMany`), inclusive vazios, cada um como o card atual; setores com servos continuam com a tabela.
   - No header de cada card de setor, botão "+ Adicionar servo" que abre uma **janela suspensa (modal)** — client component novo, ex. `src/app/(admin)/servos/AdicionarServoModal.tsx`.
   - Remover o botão global "+ Novo servo" do topo (a rota `/servos/novo` pode continuar existindo; a edição `/servos/[id]` fica como está).
2. **Modal**: campo de nome; conforme digita (debounce ~250ms, mínimo 2 caracteres) sugere nomes existentes.
   - Server action de busca (ex. `buscarPessoasGlobal(missaoId, termo)`): procura em `Pessoa.nome` (contains) E em `Neocampista.nome` (contains, qualquer missão) cujo nome não exista em Pessoa. Retornar por item: origem (`pessoa`|`campista`), id, nome, cidade, nº de missões como servo (para Pessoa), e se já é servo NA missão ativa (para desabilitar/avisar). Máx ~10 resultados, ordenados por nº de missões desc.
   - Ao selecionar uma sugestão, ela aparece preenchida/selecionada no modal (chip com nome + cidade) antes de confirmar.
   - Se nenhum resultado, permitir confirmar o nome digitado como pessoa nova.
3. **Server action `adicionarServoRapido`** (em `actions.ts`, com `requireUser()`):
   - Entrada: missaoId, setor, e (pessoaId | neocampistaId | nomeNovo).
   - `pessoaId`: criar `Servo` com `setor`, `funcao: "INTEGRANTE"`, `status: "ATIVO"`. Se já existe na missão (unique constraint), retornar erro amigável "já está no quadrante desta missão (setor X)".
   - `neocampistaId`: buscar a ficha; procurar Pessoa com mesmo nome (case-insensitive, trim); se não existir, criar Pessoa copiando da ficha: nome (via `normalizarNome`), endereco, bairro, cidade, celular, sexo, camiseta, cpf. Depois criar o Servo como acima.
   - `nomeNovo`: criar Pessoa só com nome normalizado + Servo.
   - `revalidatePath("/servos")`. O servo novo aparece na tabela do setor.

## Parte B — Cerco público em lista + autocomplete + privacidade (`src/app/cerco/[slug]/CercoForm.tsx` e action `inscreverCerco`)

1. **Remover o dial radial (a "bola de relógio")**: a escolha de horário passa a ser SÓ a lista de botões de horário (hoje já existe uma versão em lista para mobile — promover a lista para todos os tamanhos de tela e apagar o SVG do dial). Cada item mostra o horário e a ocupação "n/15"; cheio (≥15) fica desabilitado com o vermelho `--signal`. Manter o visual devocional da página.
2. **Autocomplete no campo nome (público)**: conforme o servo digita (mín. 3 caracteres, debounce), sugerir nomes — NUNCA uma lista aberta de todos. Server action pública nova (ex. `sugerirNomesCerco(missaoId, termo)`) que retorna APENAS strings de nomes (máx. 8) dos servos ATIVOS da missão. **Proibido retornar horário, setor, ou qualquer outro dado** — se um servo digitar o nome de outro, ele só confirma que o nome existe, sem ver em que horário a pessoa está.
3. **Auditoria de privacidade**: conferir que nem o HTML da página pública nem qualquer resposta de action pública expõe o horário escolhido por outras pessoas — só contagens agregadas por horário. Quem vê nome×horário é apenas o admin em `/cerco-dashboard` (que exige login — conferir `requireUser`).
4. `inscreverCerco` continua com a mesma regra (match por nome case-insensitive, cap 15/horário server-side).

## Critérios de aceite
- `npx tsc --noEmit` limpo.
- `/servos`: todos os setores visíveis; adicionar servo existente por autocomplete sem redigitar nada; adicionar campista de missão antiga vira Pessoa+Servo com dados copiados; duplicado na missão dá erro amigável.
- `/cerco/[slug]`: sem dial; lista de horários com ocupação; autocomplete de nome retorna só nomes; nenhum dado de horário alheio exposto publicamente.
- Não tocar em banco/import/scripts. Não é repositório git — não rodar comandos git.
