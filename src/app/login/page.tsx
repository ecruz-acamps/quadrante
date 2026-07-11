"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--ink)] relative overflow-hidden">
      <svg
        aria-hidden
        viewBox="0 0 400 400"
        className="absolute w-[600px] h-[600px] opacity-[0.08] pointer-events-none"
      >
        {Array.from({ length: 24 }, (_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const x2 = 200 + Math.cos(angle) * 190;
          const y2 = 200 + Math.sin(angle) * 190;
          return (
            <line key={i} x1="200" y1="200" x2={x2} y2={y2} stroke="var(--brass-bright)" strokeWidth="1.5" />
          );
        })}
        <circle cx="200" cy="200" r="60" fill="none" stroke="var(--brass-bright)" strokeWidth="2" />
      </svg>

      <form
        action={action}
        className="relative bg-[var(--card)] rounded-lg shadow-2xl p-8 w-full max-w-sm space-y-5 border border-[var(--line)]"
      >
        <div className="text-center">
          <h1 className="font-[var(--font-spectral)] text-3xl text-[var(--ink)]">Quadrante</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)] mt-1">
            Movimento Campista
          </p>
        </div>
        <div className="space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="E-mail"
            className="input"
          />
          <input
            name="senha"
            type="password"
            required
            placeholder="Senha"
            className="input"
          />
        </div>
        {state?.error && <p className="text-[var(--signal)] text-sm">{state.error}</p>}
        <button
          disabled={pending}
          className="btn-primary w-full py-2.5"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
