"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./servos/icons";

type NavItem = readonly [string, string, boolean];

const NAV_ICONE: Record<string, string> = {
  "/": "home",
  "/meu-setor": "users",
  "/servos": "users",
  "/formacao": "book",
  "/cerco-dashboard": "clock",
  "/camisetas": "shirt",
  "/setores": "layers",
  "/cidades": "pin",
  "/fichas": "clipboard",
  "/tribos": "flag",
  "/financeiro": "coin",
  "/registros": "ban",
  "/pessoas": "user",
  "/estatisticas": "chart",
  "/duplicatas": "copy",
  "/missoes": "star",
  "/usuarios": "key",
  "/gerador-fichas": "book",
  "/configuracoes": "settings",
};

function ativo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export default function AdminShell({
  nav,
  userNome,
  missaoNome,
  mostrarSeletor,
  missoes,
  missaoId,
  selecionarMissaoAction,
  logoutAction,
  children,
}: {
  nav: readonly NavItem[];
  userNome: string;
  missaoNome: string | null;
  mostrarSeletor: boolean;
  missoes: { id: number; nome: string }[];
  missaoId: number | null;
  selecionarMissaoAction: (formData: FormData) => void;
  logoutAction: () => void;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  const sidebarConteudo = (
    <>
      <div className="px-5 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brass)] text-[var(--ink)]">
            <Icon name="cross" className="h-[18px] w-[18px]" />
          </span>
          <div className="leading-tight">
            <h1 className="font-[var(--font-spectral)] text-lg font-semibold tracking-wide">Quadrante</h1>
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--brass-bright)]">Movimento Campista</p>
          </div>
        </div>
        {missaoNome && mostrarSeletor && (
          <form action={selecionarMissaoAction} className="mt-5">
            <select
              key={missaoId}
              name="id"
              defaultValue={missaoId ?? undefined}
              className="w-full rounded-lg border border-white/15 bg-white/10 px-2.5 py-2 text-xs text-[var(--paper)] transition-colors hover:bg-white/15"
            >
              {missoes.map((m) => (
                <option key={m.id} value={m.id} className="text-[var(--ink-soft)]">
                  {m.nome}
                </option>
              ))}
            </select>
            <button className="mt-2 w-full rounded-lg bg-[var(--brass)] py-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink)] transition-colors hover:bg-[var(--brass-bright)]">
              Trocar missão
            </button>
          </form>
        )}
        {missaoNome && !mostrarSeletor && (
          <p className="mt-5 rounded-lg bg-white/10 px-3 py-2 text-xs text-[var(--paper)]/80">{missaoNome}</p>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {nav.map(([href, label]) => {
          const on = ativo(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setAberto(false)}
              aria-current={on ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[0.8125rem] transition-all duration-150 ${
                on
                  ? "bg-white/12 font-medium text-white shadow-[inset_3px_0_0_var(--brass-bright)]"
                  : "text-[var(--paper)]/75 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon
                name={NAV_ICONE[href] ?? "users"}
                className={`h-[17px] w-[17px] shrink-0 transition-colors ${
                  on ? "text-[var(--brass-bright)]" : "text-[var(--paper)]/55 group-hover:text-[var(--brass-bright)]"
                }`}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
          {userNome.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--paper)]/80">{userNome}</span>
        <form action={logoutAction}>
          <button
            aria-label="Sair"
            title="Sair"
            className="rounded-md p-1.5 text-[var(--paper)]/60 transition-colors hover:bg-white/10 hover:text-[var(--brass-bright)]"
          >
            <Icon name="logout" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-[var(--font-plex-sans)]">
      {/* topo mobile */}
      <div className="md:hidden flex items-center justify-between bg-[var(--ink)] text-[var(--paper)] px-4 py-3 sticky top-0 z-30">
        <div>
          <h1 className="font-[var(--font-spectral)] text-lg tracking-wide leading-none">Quadrante</h1>
          {missaoNome && <p className="text-[0.65rem] text-[var(--paper)]/60 mt-0.5">{missaoNome}</p>}
        </div>
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="p-2 -mr-2 text-[var(--paper)]"
        >
          <Icon name="menu" className="h-6 w-6" />
        </button>
      </div>

      {/* sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[var(--ink)] text-[var(--paper)] md:flex">
        {sidebarConteudo}
      </aside>

      {/* drawer mobile */}
      {aberto && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAberto(false)} />
          <aside className="relative flex w-72 max-w-[85vw] flex-col bg-[var(--ink)] text-[var(--paper)] shadow-2xl">
            <button
              onClick={() => setAberto(false)}
              aria-label="Fechar menu"
              className="absolute top-4 right-4 p-1 text-[var(--paper)]/70"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
            {sidebarConteudo}
          </aside>
        </div>
      )}

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-auto bg-[var(--paper)]">{children}</main>
    </div>
  );
}
