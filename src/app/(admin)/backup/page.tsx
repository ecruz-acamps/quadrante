import { requireRole } from "@/lib/auth";

export default async function BackupPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  await requireRole("SUPER");
  const { drive } = await searchParams;
  const driveConectado = Boolean(process.env.GOOGLE_DRIVE_REFRESH_TOKEN);

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

      <div className="card p-4 mt-4">
        <p className="text-sm text-[var(--ink-soft)]/80 mb-2">
          Backup automático a cada 2 dias (banco + .env compactados) enviado para uma pasta
          própria no Google Drive, criada pelo Quadrante ("Backups Quadrante"). Autorize com
          a conta Google que deve ficar dona dessa pasta.
        </p>
        {drive === "conectado" && (
          <p className="text-sm text-green-700 mb-2">Google Drive conectado com sucesso.</p>
        )}
        {drive === "sem-refresh-token" && (
          <p className="text-sm text-[var(--signal)] mb-2">
            O Google não retornou um token permanente. Acesse
            myaccount.google.com/permissions, remova o acesso do Quadrante e tente conectar de novo.
          </p>
        )}
        {drive === "erro" && (
          <p className="text-sm text-[var(--signal)] mb-2">Falha na autorização. Tente novamente.</p>
        )}
        <p className="text-xs text-[var(--ink-soft)]/60 mb-4">
          Status: {driveConectado ? "conectado" : "não conectado"}
        </p>
        <a
          href="/api/backup/drive/connect"
          className="inline-block rounded px-4 py-2 bg-[var(--brass)] text-[var(--ink)] font-medium"
        >
          {driveConectado ? "Reconectar Google Drive" : "Conectar Google Drive"}
        </a>
      </div>
    </div>
  );
}
