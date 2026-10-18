import { requireQualquerUsuario, getMissaoAtiva, getMissoesPermitidas, getContextoCoordenador } from "@/lib/auth";
import { SETOR_EVANGELIZACAO } from "@/lib/coordenador";
import { logoutAction, selecionarMissao } from "@/lib/actions";
import { db } from "@/lib/db";
import AdminShell from "./AdminShell";

const NAV = [
  ["/", "Início", false],
  ["/servos", "Quadrante de Servos", false],
  ["/formacao", "Formação", false],
  ["/cerco-dashboard", "Cerco de Jericó", false],
  ["/camisetas", "Camisetas", false],
  ["/setores", "Por Setor", false],
  ["/cidades", "Por Cidade", false],
  ["/fichas", "Fichas (Neocampistas)", false],
  ["/tribos", "Tribos", false],
  ["/evangelizacao", "Evangelização", false],
  ["/financeiro", "Financeiro", false],
  ["/registros", "Não / Desistências / Faltas", false],
  ["/pessoas", "Pessoas", false],
  ["/estatisticas", "Estatísticas", true],
  ["/duplicatas", "Possíveis Duplicatas", true],
  ["/missoes", "Missões", true],
  ["/usuarios", "Usuários", true],
  ["/gerador-fichas", "Gerador de Fichas", true],
  ["/configuracoes", "Configurações", true],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireQualquerUsuario();
  if (user.role === "COORDENADOR") {
    const { missao: missaoCoord } = await getContextoCoordenador(user);
    return (
      <AdminShell
        nav={
          user.setor === SETOR_EVANGELIZACAO
            ? [["/meu-setor", "Meu setor", false], ["/evangelizacao", "Evangelização", false]]
            : [["/meu-setor", "Meu setor", false]]
        }
        userNome={user.nome}
        missaoNome={missaoCoord?.nome ?? null}
        missaoId={missaoCoord?.id ?? null}
        mostrarSeletor={false}
        missoes={[]}
        selecionarMissaoAction={selecionarMissao}
        logoutAction={logoutAction}
      >
        {children}
      </AdminShell>
    );
  }
  const missao = await getMissaoAtiva();
  const isSuper = user.role === "SUPER";
  const missoes = isSuper
    ? await db.missao.findMany({ orderBy: { id: "desc" } })
    : await getMissoesPermitidas(user.id);
  const mostrarSeletor = missoes.length > 1;
  const nav = NAV.filter(([, , superOnly]) => !superOnly || isSuper);

  return (
    <AdminShell
      nav={nav}
      userNome={user.nome}
      missaoNome={missao?.nome ?? null}
      missaoId={missao?.id ?? null}
      mostrarSeletor={mostrarSeletor}
      missoes={missoes}
      selecionarMissaoAction={selecionarMissao}
      logoutAction={logoutAction}
    >
      {children}
    </AdminShell>
  );
}
