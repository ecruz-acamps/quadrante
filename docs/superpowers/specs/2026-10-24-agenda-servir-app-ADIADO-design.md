# Agenda de servir — app "Acampamento São Padre Pio"

Data: 2026-10-24 · Status: ADIADO (o dono escolheu o formulário simples; ver 2026-10-24-servir-formulario-design.md). Guardado para quando vier o app e o "Fazer".

## Por que

Hoje, quando uma pessoa termina o acampamento e quer servir, ela responde a um Google Forms e o coordenador monta as equipes lendo as respostas, na mão. Isso é lento e fica fora do Quadrante.

A ideia é uma **agenda das próximas missões** dentro de um app. A pessoa que já fez o acampamento entra com o CPF, vê as missões que vêm aí e marca em quais quer servir. O coordenador vê os candidatos de cada missão no Quadrante e os coloca nos setores, como faz hoje.

Sucesso = o Google Forms deixa de ser usado, e o coordenador abre o Quadrante e vê quem quer servir em cada missão sem copiar nada de planilha.

## Objetivos

- Quem já fez o acampamento marca as missões em que quer servir, pelo celular (Android primeiro).
- Regra única de elegibilidade: pode servir em qualquer missão **exceto Casais**.
- O coordenador vê candidatos por missão e adiciona à equipe (setor) pelo Quadrante.
- A pessoa pode desmarcar uma missão depois de marcar.

## Fora do escopo (por enquanto)

- **Fazer**: inscrição para participar do acampamento pelo app. É um segundo projeto, depois deste.
- Integração por API com o sistema de pré-fichas (fica em outro servidor). Aqui a lista de quem pode servir vem de um Excel.
- Notificações push para a pessoa ou para o coordenador.
- iOS e App Store.
- Atribuição automática de setor. Quem decide o setor é sempre o coordenador.
- Preferência de setor pela pessoa (decisão do dono: só marca a missão).

## Anti-objetivos (seria fracasso mesmo funcionando)

- Alguém se candidatar no nome de outra pessoa só sabendo o CPF e conseguir ver dados pessoais dela. A resposta nunca devolve mais que o primeiro nome.
- Mexer na estrutura do Quadrante em produção sem o dono mandar liberar.
- Aparecer a missão Casais para quem já fez o acampamento.

## Restrições

- O Quadrante roda em produção (pm2 + Apache + Cloudflare tunnel). Qualquer mudança é **aditiva**: tabelas e colunas novas, nada alterado. Backup do `prisma/quadrante.db` antes de migrar. Só entra em produção quando o dono disser "liberar".
- O Next.js deste projeto tem mudanças que quebram o que se conhece. `AGENTS.md` exige ler `node_modules/next/dist/docs/` antes de escrever código.
- Testes no padrão do repositório (`node:test`, `src/lib/testdb.ts`). `protecao-paginas.test.ts` precisa continuar verde.
- Nome do app para o público: **Acampamento São Padre Pio**. O painel do coordenador continua se chamando Quadrante.

## Fatos conferidos no código e no banco (2026-10-24)

- Só **102 de 3.358** `Pessoa` e **113 de 3.271** `Neocampista` têm CPF real. O resto é `000.000.000-00` ou vazio. **O CPF do Quadrante não serve para identificar ninguém.** A elegibilidade precisa vir de outra fonte (o Excel).
- `Missao.tipo` aceita `MIRIM | FAC | JUVENIL | SENIOR | CASAIS`. Hoje o banco tem 28 SENIOR e 2 FAC, nenhuma CASAIS. A regra do Casais usa esse campo.
- A missão mais nova é a `25º Acampamento Sênior`, com `dataInicio` `2027-02-05`. A 24ª não tem data. Várias missões antigas têm `dataInicio` nulo.
- Existe o helper `checarConflitoServo` (bloqueio de servo em missões próximas) e a tela de adicionar servo, que a triagem deve reaproveitar.
- Já existe `public/manifest.webmanifest`, `public/sw.js` e `RegisterSW.tsx`: o Quadrante já é instalável como PWA.

## Decisões do dono

- Começar pelo **Servir**. O Fazer vem depois.
- Identificação só por **CPF**, sem senha.
- A fonte de quem já fez o acampamento é um **Excel** exportado do sistema de pré-fichas.
- Só existe a regra "Casais não".
- A pessoa só marca missões. Não escolhe setor.
- O app precisa nascer **pronto para virar app**, Android primeiro.

## Decisões minhas (o dono não decidiu; revisar)

1. **Elegibilidade.** Tabela nova `ElegivelServir` (cpf só com dígitos, nome, rótulo do acampamento que fez), alimentada por importação do Excel. Substituível depois pela API das pré-fichas sem mudar o resto.
2. **Candidatura.** Tabela nova `Candidatura` com `missaoId`, `cpf`, `criadoEm`, única por `(missaoId, cpf)`. Desmarcar apaga a linha.
3. **Missão aberta para candidaturas.** Coluna nova `Missao.servirAberto` (padrão falso). A agenda lista só missões abertas, com `dataInicio` quando existir.
4. **Sessão.** Depois de um CPF válido na lista, o servidor entrega um token assinado e de curta duração. Todas as chamadas seguintes usam o token. Limite de tentativas por IP (como `excedeuLimite` no Cerco) e por CPF. CPF fora da lista recebe a mesma mensagem genérica, para não revelar quem está na lista.
5. **API primeiro.** As telas e o app Android usam os mesmos endpoints JSON em `/api/servir/*`: entrar, listar agenda, marcar e desmarcar.
6. **App.** A agenda é uma página web responsiva e instalável (PWA). O app Android é uma casca em Capacitor que carrega essa página. Testar com APK não exige conta na Play Store. Publicar exige conta de desenvolvedor Google (US$ 25).
7. **Triagem.** Página nova no Quadrante, com `requireUser()` dentro dela, mostrando candidatos da missão ativa. "Adicionar à equipe" pede o setor e reaproveita a lógica de criar `Servo`, `Pessoa` por CPF quando existir e `checarConflitoServo`. Candidato que já é `Servo` na missão aparece como "já está no quadrante".
8. **Aceite de LGPD** na primeira entrada, com o texto curto de que a Associação guarda os dados para equipes futuras e não os compartilha. O aceite é gravado com data e hora (colunas `lgpdAceitoEm` em `ElegivelServir`).
9. **Quem cria e abre missões.** O admin cria a missão no Quadrante como hoje e liga `servirAberto`. Qualquer `tipo` diferente de CASAIS é elegível. Missão com `dataInicio` nulo só aparece se `servirAberto` estiver ligado.
10. **Ordem de entrega.** Primeiro API + página web instalável (PWA), mesmo app Next e mesmo domínio, com o token em cabeçalho `Authorization: Bearer`. A casca Capacitor/APK é a última fase e pode ficar para depois sem perder nada.
11. **Reimportar o Excel** faz upsert por CPF e nunca apaga ninguém nem candidaturas existentes. **Desmarcar** é bloqueado quando a pessoa já foi adicionada como `Servo` na missão (quem tira é o coordenador).

## Telas (descrição, sem mockup)

**App / agenda da pessoa**
1. Entrar: campo de CPF e botão. Erro genérico se não estiver na lista.
2. Agenda: lista de missões abertas em ordem de data. Cada cartão tem nome, data e um botão "Quero servir" que vira "Marcado ✓" e pode ser desfeito. Casais nunca aparece. Quem já é servo na missão vê "Você já está na equipe".
3. Sair.

**Quadrante / candidatos**
- Missão ativa, lista de candidatos com nome (da lista de elegíveis), celular se existir, histórico de missões que serviu quando houver `Pessoa` ligada, e a ação "Adicionar à equipe".
- Exportar xlsx, no estilo de `servos/exportar/route.ts`.

**Quadrante / configurações**
- Interruptor "Abrir candidaturas" por missão (`servirAberto`) e importação do Excel de elegíveis.

## Fica para quem for construir

- Formato exato do Excel de elegíveis (o dono vai enviar o arquivo) e como lidar com CPF repetido ou inválido na importação.
- Como ligar `ElegivelServir` a `Pessoa` quando o CPF do Quadrante é zerado (nome normalizado + nascimento, ou deixar sem ligação).
- Duração do token e armazenamento no app.
- Configuração do Capacitor e ícones.

## Erros e casos de borda

- CPF com dígitos verificadores inválidos: rejeita antes de consultar a lista.
- Missão fechada ou do tipo CASAIS: o servidor rejeita a candidatura mesmo que o app tente enviar.
- Marcar duas vezes: idempotente, não duplica.
- Missão sem `dataInicio`: aparece no fim da agenda, sem data.

## Testes

- Validação de CPF.
- Entrar: CPF na lista, fora da lista, limite de tentativas.
- Agenda: não mostra CASAIS nem missão fechada.
- Marcar e desmarcar: idempotência, unicidade `(missaoId, cpf)`.
- Triagem: adicionar à equipe cria `Servo`, respeita conflito de missões, bloqueia duplicado.
- `protecao-paginas.test.ts` continua verde com a página e as rotas novas.

## Migração e deploy

Migração Prisma aditiva: 2 tabelas novas e 1 coluna com padrão. Deploy como de costume: backup do `quadrante.db`, `migrate deploy`, `npm run build`, `pm2 restart quadrante` e `pm2 save`. Só quando o dono mandar liberar.
