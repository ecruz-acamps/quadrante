# Plano pós-import histórico — xerere_convertido.xlsx

> Análise: 2026-07-08 (Fable). Decisões do usuário incorporadas. Execução: Sonnet.
> **NUNCA re-rodar `scripts/import-historico.ts`** — ressuscita duplicatas de Pessoa já fundidas manualmente (caso "Camila Bonfin"). Backup pré-import: `prisma/quadrante.db.bak-antes-historico`.

## Estado do banco (verificado 2026-07-08)

- 19 missões: 16 históricas (ids 5–20), "22° Acampamento Sênior" (id 1), "23º" (id 4), "99 Acampamento" (id 53, teste de UI — perguntar antes de apagar).
- 1.722 Pessoas, 3.446 Servos, 2.093 Neocampistas.
- Nenhum registro Servo duplicado (pessoa+missão) — verificado, 0 pares.
- Histórico cross-missão funciona: 658 pessoas em 2+ missões; topo César Schmidt (12).

## Decisões tomadas (usuário, 2026-07-08)

1. **Campo `ano`: não mexer.** O usuário não usa essa nomenclatura — a identificação das missões é pelo nome/edição ("11 Senior São José", "22° Acampamento Sênior"). Nenhuma correção ou padronização de `ano`; não usar `ano` para ordenar/exibir nada novo.
2. **Setor "LÍDER" é legítimo, não é duplicata de outro setor.** No histórico (xerere) os líderes de tribo aparecem uma única vez, com setor "LÍDER", função "INTEGRANTE" e a tribo; o setor real deles não consta na planilha. (No 22° Sênior atual, eles aparecem no Quadrante com setor real E na Divisão de Tribos como líder — modelos diferentes, ambos corretos.) Única correção: normalizar a grafia **`LÍDERES` → `LÍDER`** (33 registros).
3. **Normalizar casing dos nomes de Pessoa** — aprovado. Title-case com exceções (de, da, do, dos, das, e); ex.: "PAULINO HECKE" → "Paulino Hecke". Script one-shot no banco + normalização na gravação (server actions de criação/edição de Pessoa). Comparações de duplicata continuam case-insensitive.
4. **Triagem de /duplicatas** — o usuário cuida, nada a fazer no código.
5. **Dados faltantes (aniversário/celular/cidade)** — ignorar.

## Ordem de execução (Sonnet)

1. `UPDATE Servo SET setor='LÍDER' WHERE setor='LÍDERES'` (script ou SQL direto; conferir contagem antes/depois: 33 → 0).
2. Script `scripts/normaliza-nomes.ts`: title-case em `Pessoa.nome` (e avaliar `endereco`/`bairro`/`cidade` — confirmar com usuário se quer além do nome), com dry-run listando amostra antes de aplicar. Depois, aplicar a mesma normalização nas server actions que criam/editam Pessoa (`src/lib/actions.ts`).
3. **Fazer backup do banco antes dos passos 1–2** (`cp prisma/quadrante.db prisma/quadrante.db.bak-antes-normalizacao`).

## Oportunidades de produto (backlog, depois das correções)

- Ficha da pessoa (`/pessoas/[id]`): linha do tempo de missões, setores/funções por edição, contagem de participações.
- Badge de veterania no Quadrante de Servos da missão atual (ex.: "12ª missão").
- Estatísticas por edição: evolução de servos/campistas nas 16+ edições.
- Busca global de pessoas cruzando missões.
