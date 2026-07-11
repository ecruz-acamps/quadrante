import { requireUser, getMissaoAtiva, getMissoesPermitidas } from "@/lib/auth";
import { logoutAction, selecionarMissao } from "@/lib/actions";
import { db } from "@/lib/db";
import AdminShell from "./AdminShell";

const NAV = [
  ["/", "Início", false],
  ["/servos", "Quadrante de Servos", false],
  ["/cerco-dashboard", "Cerco de Jericó", false],
  ["/camisetas", "Camisetas", false],
  ["/setores", "Por Setor", false],
  ["/cidades", "Por Cidade", false],
  ["/fichas", "Fichas (Neocampistas)", false],
  ["/tribos", "Tribos", false],
  ["/financeiro", "Financeiro", false],
  ["/registros", "Não / Desistências / Faltas", false],
  ["/pessoas", "Pessoas", false],
  ["/estatisticas", "Estatísticas", true],
  ["/duplicatas", "Possíveis Duplicatas", true],
  ["/missoes", "Missões", true],
  ["/usuarios", "Usuários", true],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
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
