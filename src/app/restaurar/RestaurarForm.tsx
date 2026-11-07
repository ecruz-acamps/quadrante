"use client";

import { useState, type FormEvent } from "react";

type Estado = { tipo: "erro" | "ok" | "enviando"; texto: string } | null;

async function aguardarSistemaVoltar() {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const r = await fetch("/login", { cache: "no-store" });
      if (r.ok) break;
    } catch {
      // o servidor ainda está reiniciando
    }
  }
  // recarga completa de propósito: o servidor acabou de reiniciar com outro banco e outro .env
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login";
}

function Mensagem({ estado }: { estado: Estado }) {
  if (!estado) return null;
  const cor = estado.tipo === "erro" ? "text-[var(--signal)]" : "text-[var(--ink)]";
  return <p className={`${cor} text-sm`}>{estado.texto}</p>;
}

export default function RestaurarForm() {
  const [backup, setBackup] = useState<Estado>(null);
  const [zero, setZero] = useState<Estado>(null);

  async function restaurar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBackup({ tipo: "enviando", texto: "Restaurando… isso pode levar alguns segundos." });
    try {
      const r = await fetch("/api/restaurar", { method: "POST", body: new FormData(e.currentTarget) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setBackup({ tipo: "erro", texto: j.erro ?? "Não foi possível restaurar o backup." });
        return;
      }
      setBackup({ tipo: "ok", texto: "Backup restaurado. O sistema está reiniciando…" });
      await aguardarSistemaVoltar();
    } catch {
      setBackup({ tipo: "erro", texto: "Não foi possível enviar o arquivo. Confira a conexão e tente de novo." });
    }
  }

  async function comecarDoZero(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setZero({ tipo: "enviando", texto: "Criando o administrador…" });
    try {
      const r = await fetch("/api/restaurar/zero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fd)),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setZero({ tipo: "erro", texto: j.erro ?? "Não foi possível criar o administrador." });
        return;
      }
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login"; // recarga completa: o código de restauração foi removido do .env
    } catch {
      setZero({ tipo: "erro", texto: "Não foi possível enviar os dados. Tente de novo." });
    }
  }

  const ocupado = backup?.tipo === "enviando" || backup?.tipo === "ok";

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--ink)]">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="font-[var(--font-spectral)] text-3xl text-[var(--card)]">Quadrante</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass-bright)] mt-1">Primeira configuração</p>
        </div>

        <form onSubmit={restaurar} className="bg-[var(--card)] rounded-lg shadow-2xl p-6 space-y-4 border border-[var(--line)]">
          <h2 className="font-medium text-[var(--ink)]">Restaurar um backup</h2>
          <p className="text-sm text-[var(--ink-soft)]/80">
            Baixe do Google Drive o arquivo <code>quadrante-backup-….tar.gz.gpg</code> mais recente e envie aqui, com a
            senha do backup.
          </p>
          <input name="codigo" required placeholder="Código de restauração (mostrado no terminal)" autoComplete="off" className="input" />
          <input name="arquivo" type="file" required accept=".gpg" className="input" />
          <input name="senha" type="password" required placeholder="Senha do backup" autoComplete="off" className="input" />
          <Mensagem estado={backup} />
          <button disabled={ocupado} className="btn-primary w-full py-2.5">
            {ocupado ? "Aguarde…" : "Restaurar backup"}
          </button>
        </form>

        <details className="bg-[var(--card)] rounded-lg shadow-2xl p-6 border border-[var(--line)]">
          <summary className="cursor-pointer font-medium text-[var(--ink)]">Não tenho backup: começar do zero</summary>
          <form onSubmit={comecarDoZero} className="space-y-3 mt-4">
            <p className="text-sm text-[var(--ink-soft)]/80">Cria o primeiro administrador de um sistema vazio.</p>
            <input name="codigo" required placeholder="Código de restauração" autoComplete="off" className="input" />
            <input name="nome" required placeholder="Nome" className="input" />
            <input name="email" type="email" required placeholder="E-mail" className="input" />
            <input name="senha" type="password" required minLength={10} placeholder="Senha (mínimo 10 caracteres)" autoComplete="new-password" className="input" />
            <Mensagem estado={zero} />
            <button disabled={zero?.tipo === "enviando"} className="btn-primary w-full py-2.5">
              Criar administrador
            </button>
          </form>
        </details>
      </div>
    </main>
  );
}
