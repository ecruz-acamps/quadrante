# Evangelização: equipes e distribuição automática das casas

Data: 2026-10-17 · Status: aguardando revisão

## Objetivo

Durante a missão, cerca de 100 servos do setor **EVANGELIZAÇÃO** visitam a casa de cada neocampista. Hoje a secretaria olha o endereço de cada ficha e distribui as casas na mão. Esta feature automatiza esse trabalho em duas fases:

1. **Formar as equipes** de visita.
2. **Sortear as casas** entre as equipes, respeitando as regras de cidade.

Por que existe: a distribuição manual é lenta, e o erro que a secretaria evita (um servo visitando a própria cidade) é o que mais importa não cometer.

## Regras do negócio (ditas pelo usuário)

- Equipe com **3 pessoas**. Cada equipe recebe **3 a 4 casas**.
- **Carro ancora a equipe.** Na formação se pergunta quem tem carro, e cada equipe precisa de pelo menos um carro.
- Ao montar equipes, o usuário tenta juntar servos da **mesma cidade ou de cidades vizinhas**.
- **Impedimento:** neocampista de uma cidade não pode ser visitado por servo dessa cidade. Exemplo: neocampista de Palhoça não é visitado por servo de Palhoça.
- **Preferência:** entre os permitidos, vão primeiro os servos de cidades vizinhas. Exemplo: neocampista de Palhoça é visitado de preferência por servos de São José ou Santo Amaro.
- As fichas dos neocampistas **chegam aos poucos até o dia da missão**. A equipe só fica sabendo para onde vai no **início da missão**.

## Objetivos, não objetivos, anti-objetivos

**Objetivos**
- Sugerir equipes e sugerir a distribuição das casas, ambas editáveis na mão.
- Mostrar problemas na hora: equipe sem carro, casa em cidade impedida, equipe com mais de 4 casas.
- Gerar a lista imprimível por equipe.

**Não objetivos (por enquanto)**
- Acompanhar o resultado das visitas (visitou, não encontrou, reagendar). Dito explicitamente pelo usuário: "só distribui e gera por enquanto".
- Rota otimizada com mapa ou geocodificação por endereço. A proximidade é por cidade e bairro.
- Acesso do coordenador de Evangelização (o `/meu-setor` é outra melhoria, adiada).

**Anti-objetivos (seria falha mesmo que "funcione")**
- Uma equipe visitar a casa de uma cidade onde mora qualquer um dos seus 3 membros, sem aviso.
- O sistema gravar a distribuição como definitiva e impedir a secretaria de corrigir.
- Dados sujos de cidade escondendo um impedimento (ver abaixo).

## Dados

### Problema central: nomes de cidade sujos

Os nomes de cidade nas fichas e nas pessoas vêm digitados à mão. Na base real aparecem, para a mesma cidade, grafias como `Palhoça`, `PALHOÇA`, `Palhoça - SC`; `Santo Amaro`, `Santo Amaro da Imperatriz`, `SANTO AMARO DA IMPERATRIZ`, `Sto Amaro Imp. - SC`, `Sto Amaro Imperatriz`; `Florianópolis` e `Florianopolis`; `Anitápolis`, `Anitápolis - SC`, `ANITÁPOLIS`. Cerca de 89 fichas históricas estão sem cidade. Se o impedimento comparar texto cru, "Palhoça" e "PALHOÇA" parecem cidades diferentes e a regra falha em silêncio.

Por isso a feature começa por uma **cidade canônica**:

- Nova tabela `Cidade` (`id`, `nome` canônico, ex.: "Palhoça").
- Nova tabela `CidadeApelido` (`apelido`, `cidadeId`), onde `apelido` é a grafia normalizada (minúsculas, sem acento, sem " - SC", sem pontuação). O sistema normaliza a cidade de uma ficha ou pessoa e procura o apelido.
- Cidade sem apelido conhecido **não é ignorada**: aparece numa lista "cidades não reconhecidas" para o usuário associar a uma cidade canônica com um clique. Ficha sem cidade aparece numa lista "sem cidade" e fica fora do sorteio até ser corrigida.
- Nova tabela `CidadeVizinha` (`cidadeId`, `vizinhaId`), simétrica. Editável numa tela. Eu rascunho a carga inicial para a região (Palhoça, São José, Santo Amaro da Imperatriz, Biguaçu, Florianópolis, Águas Mornas, Anitápolis, Rancho Queimado, Angelina, Leoberto Leal, Armazém, Laguna e outras que aparecerem). O usuário confere.

Decisão minha: a canonicalização é por apelido normalizado, não por reescrever as colunas `cidade` existentes. O texto original das fichas e pessoas não é alterado.

### Campos novos

- `Servo.temCarro Boolean @default(false)`, perguntado na formação.
- `Missao.evangelizacaoFechada Boolean @default(false)`: uma trava só por missão (ver "Fechar o resultado"). Decisão minha.
- Tabela `EquipeEvangelizacao` (`id`, `missaoId`, `nome`). Um conjunto de equipes por missão.
- `Neocampista.casaFixada Boolean @default(false)`: casa movida na mão, que o sorteio não desfaz.
- `Servo.equipeEvangelizacaoId Int?`, para os membros da equipe.
- `Neocampista.equipeEvangelizacaoId Int?`, para a equipe que visita a casa.

Migração aditiva, tudo nullable ou com padrão. Backup do banco antes de aplicar, no padrão `prisma/quadrante.db.bak-antes-<nome>`.

## Fase 1: formar as equipes

- Entrada: `Servo` da missão com `setor = "EVANGELIZAÇÃO"` e `status = "ATIVO"` (o setor é um campo do próprio servo, por missão). A cidade do servo vem de `Pessoa.cidade`, normalizada pelo apelido, e `temCarro` do servo.
- **Servo sem cidade ou com cidade não reconhecida:** a equipe dele fica marcada como "cidade desconhecida", **fora do sorteio** até a cidade ser corrigida, e a formação mostra o aviso. Escolha segura minha: o erro que a feature existe para evitar é visitar a própria cidade, então na dúvida a equipe não recebe casas, e isso aparece em destaque.
- Servo que sai ou entra depois da formação: a equipe é revalidada na hora (carro, tamanho, cidades). O sistema **não move casas sozinho**; marca na lista de pendências as casas que passaram a violar o impedimento.
- Sugestão: agrupa por cidade e, depois, por cidades vizinhas, em grupos de 3, garantindo pelo menos um carro por equipe. Sobra de 1 ou 2 servos vira equipe de 4 ou de 2, sinalizada ao usuário (decisão minha: tamanho 3 é o alvo, 4 e 2 são aceitos como exceção avisada).
- Se houver menos carros que equipes, o sistema avisa antes de seguir e mostra quantas equipes ficam sem carro.
- Tela: lista de equipes com os membros, cidade e carro de cada um; arrastar ou trocar servo de equipe; criar e apagar equipe; marcadores de aviso (sem carro, tamanho diferente de 3, membros de cidades que não são vizinhas).
- Pode ser feita e fechada antes de chegarem as fichas.

## Fase 2: sortear as casas

Roda sobre as fichas da missão com `situacao = "OK"` (único valor existente hoje, e o filtro que o resto do sistema já usa) e pode ser **repetida à vontade** até o fechamento. Cada rodada refaz **todas as casas não fixadas**; as fixadas ficam como estão.

**Prioridade quando as regras brigam** (decisão minha), da mais forte para a mais fraca:

1. Impedimento de cidade: nunca é quebrado pelo algoritmo. Se só sobrar equipe impedida, a casa fica sem equipe e vai para as pendências.
2. Equilíbrio de 3 a 4 casas por equipe.
3. Preferência por equipe de cidade vizinha.
4. Agrupar as casas da equipe por cidade e bairro.

Com poucas fichas (menos de 3 casas por equipe), o sistema espalha por igual e deixa equipes com menos de 3 ou vazias, sem forçar nada. O mínimo de 3 só vale quando há casas suficientes.

Vizinhança significa **adjacência direta**, não vizinho do vizinho. A tela de vizinhança mostra um aviso visível enquanto a tabela não tiver sido conferida pelo usuário.

Para cada neocampista:

1. **Equipes permitidas:** nenhum membro mora na cidade do neocampista (comparação pela cidade canônica, nunca pelo texto).
2. **Ordem de preferência:** primeiro as equipes em que algum membro mora em cidade vizinha à do neocampista, depois as demais permitidas.
3. **Capacidade:** cada equipe recebe de 3 a 4 casas. O sistema equilibra para que todas fiquem em 3 ou 4 sempre que o total permitir (com N casas e E equipes, ficam entre `floor(N/E)` e `ceil(N/E)`; se o total passar de 4 por equipe, o sistema mostra o excedente).
4. **Casas juntas:** as casas de uma equipe são agrupadas por cidade e bairro, para ficarem perto uma da outra.
5. **Sorteio:** entre as opções equivalentes, a escolha é aleatória, para que refazer o sorteio possa dar um resultado diferente.

Casos que o sistema **não esconde**: casa sem equipe permitida (todas as equipes têm alguém da cidade), casa alocada em equipe não vizinha, equipe acima de 4 casas, ficha sem cidade ou com cidade não reconhecida. Todos aparecem numa lista de pendências.

Edição manual: o usuário move uma casa para outra equipe. Se a troca violar o impedimento, o sistema avisa com a razão ("alguém dessa equipe mora em Palhoça") mas não proíbe (decisão minha: o usuário conhece casos que o sistema não conhece, mas a violação fica marcada em destaque).

Casas movidas na mão ficam **fixadas**, e um novo sorteio não as desfaz (decisão minha). Há um botão para limpar as fixações.

### Fechar o resultado

No início da missão o usuário aperta **Fechar distribuição** (qualquer ADMIN da missão ou SUPER). É uma trava única por missão (`Missao.evangelizacaoFechada`). Fechada, ficam bloqueados: novo sorteio, mover casa, trocar membro de equipe, criar e apagar equipe. A lista só pode ser impressa com a distribuição fechada; antes disso ela existe apenas na tela do admin (decisão minha, para o endereço dos neocampistas não circular antes da hora). Só o SUPER pode reabrir, no padrão dos demais controles do sistema.

## Saída

Lista por equipe, imprimível: nome da equipe, os 3 membros com celular, quem leva o carro, e as 3 a 4 casas com nome do neocampista, endereço, bairro, cidade e celular. Uma página por equipe. Também uma visão geral para a secretaria, com todas as equipes e a contagem de casas por cidade.

## Permissões

Telas novas em `(admin)`, com `requireUser()` na primeira linha, como o resto. A reabertura da distribuição exige `requireRole("SUPER")`. Vale também para a missão ativa do usuário (ADMIN só vê as missões que lhe foram vinculadas).

## O que fica para quem for construir

- Algoritmo exato de agrupamento das equipes e do sorteio (guloso com aleatoriedade, ou outro), desde que cumpra as regras acima e seja coberto por testes.
- Layout das telas, seguindo o sistema de design do Quadrante.
- A carga inicial da tabela de apelidos de cidade, a partir das grafias existentes na base, para o usuário conferir.
- Formato exato de impressão (uma página por equipe).

## Testes esperados

A lógica de formar equipes e de sortear é código puro, testado como o `chamado.ts`: impedimento por cidade (incluindo grafias diferentes), preferência por vizinha, equilíbrio de 3 a 4 casas, equipe sem carro, ficha sem cidade, casa sem equipe permitida, fixações respeitadas no novo sorteio e resultado diferente em sorteios repetidos.
