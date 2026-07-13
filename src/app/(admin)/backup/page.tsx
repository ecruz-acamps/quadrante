import { requireRole } from "@/lib/auth";

export default async function BackupPage() {
  await requireRole("SUPER");

  return (
    <div className="max-w-2xl">
      <h1 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)] mb-6">Backup</h1>

      <div className="card p-4">
        <p className="text-sm text-[var(--ink-soft)]/80 mb-4">
          Baixa uma cópia completa do banco de dados no estado atual. Guarde o arquivo em
          um local seguro (ex: seu computador ou um serviço de nuvem).
        </p>
        <a
          href="/api/backup"
          className="inline-block rounded px-4 py-2 bg-[var(--brass)] text-[var(--ink)] font-medium"
        >
          Baixar backup
        </a>
      </div>

      <div className="card p-4 mt-4">
        <p className="text-sm text-[var(--ink-soft)]/80 mb-4">
          Baixa o arquivo <code>.env</code> atual (segredos: chave de sessão, credenciais do
          login Google, etc). Contém dados sensíveis — guarde com o mesmo cuidado de uma senha
          e nunca compartilhe ou suba para repositórios públicos.
        </p>
        <a
          href="/api/backup/env"
          className="inline-block rounded px-4 py-2 bg-[var(--brass)] text-[var(--ink)] font-medium"
        >
          Baixar .env
        </a>
      </div>
    </div>
  );
}
