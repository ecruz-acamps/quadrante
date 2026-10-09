import { db } from "./db";

type TipoNotificacao = "conflito" | "cerco";

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

export async function notificarPushbird(
  tipo: TipoNotificacao,
  title: string,
  message: string,
  subtitle?: string
) {
  const campo = tipo === "conflito" ? "notificarConflito" : "notificarCerco";
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
  const dispositivos = await db.pushbirdDevice.findMany();
  const urls = new Set(dispositivos.map((d) => d.webhookUrl));
  if (process.env.PUSHBIRD_WEBHOOK_URL) urls.add(process.env.PUSHBIRD_WEBHOOK_URL);
  await Promise.all([...urls].map((url) => enviar(url, title, message)));
}
