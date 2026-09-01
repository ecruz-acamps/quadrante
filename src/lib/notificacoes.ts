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
