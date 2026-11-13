import { requireRole, getMissaoAtiva } from "@/lib/auth";
import { db } from "@/lib/db";
import CercoPublicoToggle from "./CercoPublicoToggle";
import PushbirdDevices from "./PushbirdDevices";
import NotificacoesNativas from "./NotificacoesNativas";
import ExportacaoOculta from "./ExportacaoOculta";
import TunelCloudflare from "./TunelCloudflare";
import { lerStatusTunel } from "@/lib/auxiliarTunel";
import { lerStatusAtualizacao, verificarDisponivel } from "@/lib/atualizacaoSistema";
import AtualizarSistema from "./AtualizarSistema";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  await requireRole("SUPER");
  const { drive } = await searchParams;
  const driveConectado = Boolean(process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
  const tunel = await lerStatusTunel();
  const [atualizacao, disponivel] = await Promise.all([lerStatusAtualizacao(), verificarDisponivel()]);
  const missao = await getMissaoAtiva();
  const dispositivosPushbird = await db.pushbirdDevice.findMany({ orderBy: { nome: "asc" } });
  const inscritosWebPush = await db.webPushSubscription.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const ocultas = await db.pessoa.findMany({
    where: { ocultarNaExportacao: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  const servosAtivos = missao
    ? await db.servo.findMany({
        where: { missaoId: missao.id, status: "ATIVO", pessoa: { ocultarNaExportacao: false } },
        select: { setor: true, pessoa: { select: { id: true, nome: true } } },
        orderBy: { pessoa: { nome: "asc" } },
      })
    : [];
  const candidatas = servosAtivos.map((s) => ({ id: s.pessoa.id, nome: s.pessoa.nome, setor: s.setor }));

  return (
    <div className="max-w-2xl">
      <h1 className="page-title mb-6">Configurações</h1>

      <nav className="flex gap-4 mb-6 text-sm border-b border-[var(--line)]">
        <a href="#backup" className="px-1 pb-2 border-b-2 border-[var(--brass)] text-[var(--ink)] font-medium">
          Backup
        </a>
        <a href="#acesso" className="px-1 pb-2 text-[var(--ink-soft)]/70 hover:text-[var(--ink)]">
          Acesso
        </a>
        <a href="#atualizacao" className="px-1 pb-2 text-[var(--ink-soft)]/70 hover:text-[var(--ink)]">
          Atualização
        </a>
        <a href="#exportacao" className="px-1 pb-2 text-[var(--ink-soft)]/70 hover:text-[var(--ink)]">
          Exportação
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
            <strong>Levar para um servidor novo:</strong> baixa o sistema completo (banco + configurações) em um único arquivo.
            No servidor novo, abra a tela <code>/restaurar</code>, escolha este arquivo e clique em Restaurar (sem senha).
            O arquivo contém as chaves do sistema: apague-o depois de usar.
          </p>
          <a
            href="/api/backup?completo=1"
            className="inline-block rounded px-4 py-2 border border-[var(--brass)] text-[var(--ink)] font-medium"
          >
            Baixar para levar a outro servidor
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
            Backup automático diário (banco + .env, criptografados) enviado para uma pasta
            própria no Google Drive, criada pelo Quadrante (&quot;Backups Quadrante&quot;). Se o backup
            falhar, você recebe um aviso no celular. Autorize com a conta Google que deve ficar
            dona dessa pasta.
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

      <section id="acesso" className="scroll-mt-4 mt-10">
        <h2 className="font-medium text-[var(--ink)] mb-3">Acesso pela internet (Cloudflare)</h2>
        <TunelCloudflare disponivel={tunel.disponivel} ativo={tunel.ativo} hostname={process.env.TUNEL_HOSTNAME ?? null} />
      </section>

      <section id="atualizacao" className="scroll-mt-4 mt-10">
        <h2 className="font-medium text-[var(--ink)] mb-3">Atualização do sistema</h2>
        <AtualizarSistema inicial={atualizacao} disponivel={disponivel} />
      </section>

      <section id="exportacao" className="scroll-mt-4 mt-10">
        <h2 className="font-medium text-[var(--ink)] mb-3">Exportação (Excel)</h2>
        <ExportacaoOculta ocultas={ocultas} candidatas={candidatas} />
      </section>

      <section id="notificacoes" className="scroll-mt-4 mt-10">
        <h2 className="font-medium text-[var(--ink)] mb-3">Notificações</h2>
        <NotificacoesNativas inscritos={inscritosWebPush} vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
        <PushbirdDevices devices={dispositivosPushbird} />
      </section>
    </div>
  );
}
