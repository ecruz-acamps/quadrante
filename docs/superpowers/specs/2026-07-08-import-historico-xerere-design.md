# Importação do histórico — xerere_convertido.xlsx

**Data:** 2026-07-08 · **Status:** aprovado pelo usuário

## Objetivo
Importar as 16 missões históricas do arquivo `/home/true/quadrante/xerere_convertido.xlsx` como Missões completas e navegáveis no seletor da sidebar, com servos, tribos, campistas e líderes.

## Fonte
16 abas, uma por missão (`1 FAC Anitapolis` … `11 Senior São José`). Colunas: NOME, ENDEREÇO, BAIRRO, CIDADE, FONE, CELULAR, E-MAIL, ANIV., SETOR, FUNÇÃO, TRIBO.
Cada aba tem duas populações separadas por linhas de seção (só coluna 0 preenchida):
- **Servos** por setor (`SECRETARIA - … TOTAL: N SERVOS`), ~3.300 linhas no total
- **Campistas** (`CAMPISTAS - TOTAL: N` seguido de blocos `TRIBO <COR> - N CAMPISTAS`), ~1.970 linhas, SETOR="CAMPISTA"

## Schema (migration aditiva)
- `Pessoa`: + `email String?`, + `aniversario String?` (texto cru; seriais Excel convertidos para `dd/mmm`)
- Nada muda em `Servo` — a cor de tribo dos líderes vai via `TriboLider`.

## Missões
- Regex no nome da aba: `/^(\d+)[º°]?\s+(FAC|Senior)\s+(.+)$/i` → ordinal, tipo, cidade (validado nas 16 abas)
- `ano` = ordinal; `tipo` = FAC|SENIOR; `nome` = nome da aba; `cercoSlug` = `hist-{tipo}-{ordinal}-{cidade-slug}`

## Pessoas (dedup)
- Casar por nome normalizado (trim + uppercase, case-insensitive); só preencher campos vazios, nunca sobrescrever
- Limpar prefixos do nome antes de casar: `Apoio:` (→ funcao=APOIO), `Auxiliares:`/`iliares:`, `Comunicação:` e afins (`<palavra>:` no início)
- FONE fixo é fallback de celular quando celular está vazio

## Servos
- Linhas das seções de setor → `Servo` com setor, funcao (INTEGRANTE/COORDENADOR/AUXILIAR/APOIO), status ATIVO
- Seção LÍDER: servos com cor de TRIBO viram `TriboLider` da tribo correspondente

## Campistas
- Blocos `TRIBO <COR>` → `Tribo` da missão (nome "TRIBO <COR>", cor preenchida)
- Cada linha → `Neocampista` alocado na tribo; `numero` = sequencial por missão (1, 2, 3… na ordem da planilha); `nucleo` = "SEM NÚCLEO" (não existia na época — decisão do usuário)

## Execução
- Script novo `scripts/import-historico.ts` (`npx tsx`), idempotente (upserts), backup do `prisma/quadrante.db` antes de rodar
- Verificação: contagens por missão batendo com os totais das linhas de seção da planilha
