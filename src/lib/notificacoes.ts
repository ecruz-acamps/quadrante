import webpush from "web-push";
import { db } from "./db";

type TipoNotificacao = "conflito" | "cerco" | "quadrante";

async function enviar(url: string, title: string, message: string, subtitle?: string) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subtitle, message }),
    });
  } catch {
    // notificação é melhor-esforço; nunca deve quebrar o fluxo do cerco
  }
}

let vapidConfigurado = false;
function configurarVapid() {
  if (vapidConfigurado) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@localhost", pub, priv);
  vapidConfigurado = true;
  return true;
}

// Web Push nativo (PWA). campo = null manda para todos os aparelhos (alertas operacionais).
export async function enviarWebPush(
  campo: "notificarConflito" | "notificarCerco" | "notificarQuadrante" | null,
  title: string,
  body: string
) {
  try {
    if (!configurarVapid()) return;
    const inscritos = await db.webPushSubscription.findMany({ where: campo ? { [campo]: true } : {} });
    const payload = JSON.stringify({ title, body, url: "/" });
    await Promise.all(
      inscritos.map(async (i) => {
        try {
          await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, payload);
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410: inscrição expirada ou removida no aparelho
          if (status === 404 || status === 410) {
            await db.webPushSubscription.delete({ where: { id: i.id } }).catch(() => {});
          }
        }
      })
    );
  } catch {
    // ver comentário em enviar()
  }
}

export async function notificarPushbird(
  tipo: TipoNotificacao,
  title: string,
  message: string,
  subtitle?: string
) {
  const campo = { conflito: "notificarConflito", cerco: "notificarCerco", quadrante: "notificarQuadrante" }[tipo];
  void enviarWebPush(campo as "notificarConflito" | "notificarCerco" | "notificarQuadrante", title, subtitle ? `${subtitle}\n${message}` : message);
  const dispositivos = await db.pushbirdDevice.findMany({ where: { [campo]: true } });

  if (dispositivos.length === 0) {
    const url = process.env.PUSHBIRD_WEBHOOK_URL;
    if (url) await enviar(url, title, message, subtitle);
    return;
  }

  await Promise.all(dispositivos.map((d) => enviar(d.webhookUrl, title, message, subtitle)));
}

// Alerta operacional (ex.: backup falhou): vai para TODOS os aparelhos cadastrados e para o webhook do .env,
// independentemente das opções de conflito/cerco de cada aparelho.
export async function notificarOperacao(title: string, message: string) {
  void enviarWebPush(null, title, message);
  const dispositivos = await db.pushbirdDevice.findMany();
  const urls = new Set(dispositivos.map((d) => d.webhookUrl));
  if (process.env.PUSHBIRD_WEBHOOK_URL) urls.add(process.env.PUSHBIRD_WEBHOOK_URL);
  await Promise.all([...urls].map((url) => enviar(url, title, message)));
}

type AcaoQuadrante = "adicionado" | "aceitou" | "recusou" | "desistiu" | "excluido" | "movido";

const TITULO_QUADRANTE: Record<AcaoQuadrante, string> = {
  adicionado: "Servo adicionado",
  aceitou: "Servo disse sim",
  recusou: "Servo disse não",
  desistiu: "Servo desistiu",
  excluido: "Servo excluído",
  movido: "Alteração de setor",
};

// Avisa alterações no quadrante. Melhor-esforço: nunca deve quebrar a ação que o chamou.
export async function notificarQuadrante(
  acao: AcaoQuadrante,
  info: { nome: string; setor: string; missaoId: number; autor: string; quantidade?: number; setorOrigem?: string }
) {
  try {
    const missao = await db.missao.findUnique({ where: { id: info.missaoId }, select: { nome: true } });
    const quem = info.quantidade ? `${info.quantidade} integrantes` : info.nome;
    const local = `Setor ${info.setor} · ${missao?.nome ?? "missão"}`;
    if (acao === "movido") {
      const mudanca = `Alteração de setor: ${info.nome}, de ${info.setorOrigem} para ${info.setor}`;
      await notificarPushbird("quadrante", mudanca, `${mudanca}\n${missao?.nome ?? "missão"}\nPor ${info.autor}`, local);
      return;
    }
    await notificarPushbird(
      "quadrante",
      `${TITULO_QUADRANTE[acao]}: ${quem}`,
      `${quem}\n${local}\nPor ${info.autor}`,
      local
    );
  } catch {
    // ver comentário em enviar()
  }
}
