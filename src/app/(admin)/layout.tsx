import Link from "next/link";
import { requireUser, getMissaoAtiva, getMissoesPermitidas } from "@/lib/auth";
import { logoutAction, selecionarMissao } from "@/lib/actions";
import { db } from "@/lib/db";

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
    <div className="min-h-screen flex font-[var(--font-plex-sans)]">
      <aside className="w-64 shrink-0 bg-[var(--ink)] text-[var(--paper)] flex flex-col">
        <div className="p-5 border-b border-white/10">
          <h1 className="font-[var(--font-spectral)] text-xl tracking-wide">Quadrante</h1>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--brass-bright)] mt-0.5">
            Movimento Campista
          </p>
          {missao && mostrarSeletor && (
            <form action={selecionarMissao} className="mt-4">
              <select
                key={missao.id}
                name="id"
                defaultValue={missao.id}
                className="w-full text-xs bg-white/10 border border-white/15 rounded px-2 py-1.5 text-[var(--paper)]"
              >
                {missoes.map((m) => (
                  <option key={m.id} value={m.id} className="text-[var(--ink-soft)]">
                    {m.nome}
                  </option>
                ))}
              </select>
              <button className="mt-2 w-full text-xs uppercase tracking-wide bg-[var(--brass)] hover:bg-[var(--brass-bright)] text-[var(--ink)] font-semibold rounded py-1.5 transition-colors">
                Trocar missão
              </button>
            </form>
          )}
          {missao && !mostrarSeletor && (
            <p className="mt-4 text-xs text-[var(--paper)]/70">{missao.nome}</p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-2 px-3 py-2 text-sm text-[var(--paper)]/85 hover:text-[var(--paper)] border-l-2 border-transparent hover:border-[var(--brass)] transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs flex items-center justify-between text-[var(--paper)]/70">
          <span className="truncate">{user.nome}</span>
          <form action={logoutAction}>
            <button className="underline hover:text-[var(--brass-bright)] transition-colors">Sair</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto bg-[var(--paper)]">{children}</main>
    </div>
  );
}
