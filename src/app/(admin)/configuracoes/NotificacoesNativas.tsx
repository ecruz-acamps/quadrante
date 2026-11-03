"use client";

import { useEffect, useState } from "react";
import { salvarWebPush, excluirWebPush, testarWebPush } from "@/lib/actions";

type Inscrito = { id: number; nome: string };

function chaveParaUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function NotificacoesNativas({
  inscritos,
  vapidPublicKey,
}: {
  inscritos: Inscrito[];
  vapidPublicKey: string | null;
}) {
  const [suportado, setSuportado] = useState(true);
  const [precisaInstalar, setPrecisaInstalar] = useState(false);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (ios && !standalone) setPrecisaInstalar(true);
    else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSuportado(false);
    }
  }, []);

  async function ativar() {
    setOcupado(true);
    setMsg("");
    try {
      if (!vapidPublicKey) throw new Error("Chaves VAPID não configuradas no servidor.");
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") throw new Error("Permissão negada. Libere nas configurações do aparelho.");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chaveParaUint8(vapidPublicKey),
        }));
      const json = sub.toJSON();
      await salvarWebPush({
        nome: /iphone/i.test(navigator.userAgent) ? "iPhone" : "Celular",
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setMsg("Notificações ativadas neste aparelho.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível ativar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="rounded border border-[var(--line)] bg-white p-4 space-y-3 mb-6">
      <div>
        <h3 className="font-medium text-[var(--ink)]">Notificações nativas (este aparelho)</h3>
        <p className="text-sm text-[var(--ink-soft)]">
          Recebe os mesmos avisos do Pushbird direto do Quadrante, sem app extra.
        </p>
      </div>

      {precisaInstalar ? (
        <p className="text-sm text-[var(--ink)]">
          No iPhone, primeiro instale o Quadrante: no Safari toque em Compartilhar → <b>Adicionar à Tela de Início</b>,
          abra o ícone criado e volte aqui.
        </p>
      ) : !suportado ? (
        <p className="text-sm text-[var(--ink)]">Este navegador não suporta notificações nativas.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={ativar} disabled={ocupado} className="rounded px-4 py-2 bg-[var(--brass)] text-[var(--ink)] font-medium">
            Ativar neste aparelho
          </button>
          {inscritos.length > 0 && (
            <button type="button" onClick={() => testarWebPush()} className="rounded px-4 py-2 border border-[var(--line)] text-[var(--ink)]">
              Enviar teste
            </button>
          )}
        </div>
      )}
      {msg && <p className="text-sm text-[var(--ink)]">{msg}</p>}

      {inscritos.length > 0 && (
        <ul className="divide-y divide-[var(--line)] text-sm">
          {inscritos.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2">
              <span>{i.nome}</span>
              <form action={excluirWebPush}>
                <input type="hidden" name="id" value={i.id} />
                <button className="text-red-700">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
