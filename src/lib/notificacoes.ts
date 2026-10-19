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

export async function notificarPushbird(
  tipo: TipoNotificacao,
  title: string,
  message: string,
  subtitle?: string
) {
  const campo = { conflito: "notificarConflito", cerco: "notificarCerco", quadrante: "notificarQuadrante" }[tipo];
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

type AcaoQuadrante = "adicionado" | "recusou" | "desistiu" | "excluido" | "movido";

const TITULO_QUADRANTE: Record<AcaoQuadrante, string> = {
  adicionado: "Servo adicionado",
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
