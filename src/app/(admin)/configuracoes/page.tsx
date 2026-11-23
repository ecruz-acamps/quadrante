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
import OneDriveConfig from "./OneDriveConfig";
import EntraConfig from "./EntraConfig";
import { urlsSugeridas } from "@/lib/entraConfig";
import { entraConfigurado } from "@/lib/microsoftAuth";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ onedrive?: string }>;
}) {
  await requireRole("SUPER");
  const { onedrive } = await searchParams;
  const integracao = await db.integracaoOneDrive.findUnique({ where: { id: 1 } });
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
        <a href="#microsoft" className="px-1 pb-2 text-[var(--ink-soft)]/70 hover:text-[var(--ink)]">
          Microsoft
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

        <section id="onedrive" className="scroll-mt-4">
          <OneDriveConfig
            configurado={entraConfigurado()}
            conta={integracao?.conta ?? null}
            pasta={integracao?.raizId ? { nome: integracao.raizNome ?? "pasta escolhida", url: integracao.raizUrl } : null}
            aviso={onedrive}
          />
        </section>
      </section>

      <section id="microsoft" className="scroll-mt-4 mt-10">
        <h2 className="font-medium text-[var(--ink)] mb-3">Microsoft Entra (login e OneDrive)</h2>
        <EntraConfig
          tenantId={process.env.ENTRA_TENANT_ID ?? ""}
          clientId={process.env.ENTRA_CLIENT_ID ?? ""}
          temSegredo={Boolean(process.env.ENTRA_CLIENT_SECRET)}
          urlLogin={process.env.ENTRA_REDIRECT_URI ?? ""}
          urlOneDrive={process.env.ONEDRIVE_REDIRECT_URI ?? ""}
          sugestao={urlsSugeridas(process.env.TUNEL_HOSTNAME)}
        />
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
