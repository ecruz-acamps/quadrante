"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = readonly [string, string, boolean];

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
      <div className="p-5 border-b border-white/10">
        <h1 className="font-[var(--font-spectral)] text-xl tracking-wide">Quadrante</h1>
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--brass-bright)] mt-0.5">
          Movimento Campista
        </p>
        {missaoNome && mostrarSeletor && (
          <form action={selecionarMissaoAction} className="mt-4">
            <select
              key={missaoId}
              name="id"
              defaultValue={missaoId ?? undefined}
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
        {missaoNome && !mostrarSeletor && (
          <p className="mt-4 text-xs text-[var(--paper)]/70">{missaoNome}</p>
        )}
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setAberto(false)}
            className={`group flex items-center gap-2 px-3 py-2 text-sm border-l-2 transition-colors ${
              pathname === href
                ? "text-[var(--paper)] border-[var(--brass)] bg-white/5"
                : "text-[var(--paper)]/85 hover:text-[var(--paper)] border-transparent hover:border-[var(--brass)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10 text-xs flex items-center justify-between text-[var(--paper)]/70">
        <span className="truncate">{userNome}</span>
        <form action={logoutAction}>
          <button className="underline hover:text-[var(--brass-bright)] transition-colors">Sair</button>
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* sidebar desktop */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[var(--ink)] text-[var(--paper)] flex-col">
        {sidebarConteudo}
      </aside>

      {/* drawer mobile */}
      {aberto && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAberto(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-[var(--ink)] text-[var(--paper)] flex flex-col">
            <button
              onClick={() => setAberto(false)}
              aria-label="Fechar menu"
              className="absolute top-4 right-4 p-1 text-[var(--paper)]/70"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
            {sidebarConteudo}
          </aside>
        </div>
      )}

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-auto bg-[var(--paper)]">{children}</main>
    </div>
  );
}
