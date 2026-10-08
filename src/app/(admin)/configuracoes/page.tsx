import { requireRole, getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import CercoPublicoToggle from "./CercoPublicoToggle";
import PushbirdDevices from "./PushbirdDevices";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  await requireRole("SUPER");
  const { drive } = await searchParams;
  const driveConectado = Boolean(process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
  const missao = await getMissaoAtiva();
  const dispositivosPushbird = await db.pushbirdDevice.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="page-title mb-6">Configurações</h1>

      <nav className="flex gap-4 mb-6 text-sm border-b border-[var(--line)]">
        <a href="#backup" className="px-1 pb-2 border-b-2 border-[var(--brass)] text-[var(--ink)] font-medium">
          Backup
        </a>
        <a href="#notificacoes" className="px-1 pb-2 text-[var(--ink-soft)]/70 hover:text-[var(--ink)]">
          Notificações
        </a>
      </nav>

      <section id="backup" className="scroll-mt-4">
        <h2 className="font-medium text-[var(--ink)] mb-3">Backup</h2>

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

        {missao && (
          <div className="card p-4 mt-4">
            <p className="text-sm text-[var(--ink-soft)]/80 mb-4">
              Controla se o link público do Cerco de Jericó (<code>/cerco/{missao.cercoSlug}</code>)
              aceita novas inscrições. Ao tirar do ar, quem acessar o link vê um aviso de
              &quot;inscrições encerradas&quot; — o resto do app continua funcionando normalmente.
            </p>
            <p className="text-xs text-[var(--ink-soft)]/60 mb-4">
              Status: {missao.cercoPublicado ? "publicado" : "fora do ar"}
            </p>
            <CercoPublicoToggle missaoId={missao.id} cercoPublicado={missao.cercoPublicado} />
          </div>
        )}

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
      </section>

      <section id="notificacoes" className="scroll-mt-4 mt-10">
        <h2 className="font-medium text-[var(--ink)] mb-3">Notificações</h2>
        <PushbirdDevices devices={dispositivosPushbird} />
      </section>
    </div>
  );
}
