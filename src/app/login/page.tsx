"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/actions";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  const erroGoogle = {
    oauth: "Não foi possível concluir o login com Google. Tente novamente.",
    dominio: "Use uma conta Google verificada do domínio do acampamento.",
  }[useSearchParams().get("error") ?? ""];
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
        {(state?.error || erroGoogle) && <p className="text-[var(--signal)] text-sm">{state?.error ?? erroGoogle}</p>}
        <button
          disabled={pending}
          className="btn-primary w-full py-2.5"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
        <div className="flex items-center gap-3 text-xs text-[var(--brass)]">
          <div className="h-px flex-1 bg-[var(--line)]" />
          ou
          <div className="h-px flex-1 bg-[var(--line)]" />
        </div>
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded border border-[var(--line)] text-sm text-[var(--ink)] hover:bg-black/5 transition"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.7-6.1 8.1-11.3 8.1-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.4-5.4C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l5.9 4.3C13.9 15.1 18.6 12 24 12c3.1 0 5.9 1.2 8 3.1l5.4-5.4C34.5 6 29.5 4 24 4 16 4 9.1 8.5 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.3C29.5 34.9 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.2 4.8C9.1 39.5 16 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.3-2.2 4.3-4.1 5.8l6.5 5.3C41.5 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          Entrar com Google
        </a>
      </form>
    </main>
  );
}
