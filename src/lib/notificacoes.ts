export async function notificarPushbird(title: string, message: string, subtitle?: string) {
  const url = process.env.PUSHBIRD_WEBHOOK_URL;
  if (!url) return;
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
