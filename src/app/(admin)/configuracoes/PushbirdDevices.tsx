"use client";

import { useState } from "react";
import { criarPushbirdDevice, atualizarPushbirdDevice, excluirPushbirdDevice } from "@/lib/actions";

type Device = {
  id: number;
  nome: string;
  webhookUrl: string;
  notificarConflito: boolean;
  notificarCerco: boolean;
};

function CamposNotificacao({
  defaultConflito,
  defaultCerco,
}: {
  defaultConflito: boolean;
  defaultCerco: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-[var(--ink)]">
      <label className="flex items-center gap-2">
        <input type="checkbox" name="notificarConflito" defaultChecked={defaultConflito} />
        Liberação de servo (conflito ao adicionar)
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="notificarCerco" defaultChecked={defaultCerco} />
        Cerco de Jericó (escolha de horário)
      </label>
    </div>
  );
}

function LinhaDispositivo({ device }: { device: Device }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <form
        action={async (formData) => {
          await atualizarPushbirdDevice(formData);
          setEditando(false);
        }}
        className="p-4 space-y-3"
      >
        <input type="hidden" name="id" value={device.id} />
        <input name="nome" required defaultValue={device.nome} placeholder="Nome do dispositivo" className="input w-full" />
        <input
          name="webhookUrl"
          required
          defaultValue={device.webhookUrl}
          placeholder="https://pushbird.app/..."
          className="input w-full"
        />
        <CamposNotificacao defaultConflito={device.notificarConflito} defaultCerco={device.notificarCerco} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditando(false)} className="btn-link text-sm">
            Cancelar
          </button>
          <button className="btn-primary px-3 py-1.5 text-sm">Salvar</button>
        </div>
      </form>
    );
  }

  return (
    <div className="p-4 flex items-center justify-between gap-3">
      <div>
        <div className="font-medium text-sm text-[var(--ink)]">{device.nome}</div>
        <div className="text-xs text-[var(--ink-soft)]/60 break-all">{device.webhookUrl}</div>
        <div className="text-xs text-[var(--ink-soft)]/60 mt-1">
          {[
            device.notificarConflito && "Liberação de servo",
            device.notificarCerco && "Cerco de Jericó",
          ]
            .filter(Boolean)
            .join(" · ") || "nenhuma notificação ativa"}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button type="button" onClick={() => setEditando(true)} className="text-sm font-medium text-[var(--ink)] transition-colors hover:text-[var(--brass)]">
          Editar
        </button>
        <form action={excluirPushbirdDevice}>
          <input type="hidden" name="id" value={device.id} />
          <button className="btn-danger-link">Excluir</button>
        </form>
      </div>
    </div>
  );
}

export default function PushbirdDevices({ devices }: { devices: Device[] }) {
  const [mostrarForm, setMostrarForm] = useState(false);

  return (
    <div className="card">
      <div className="p-4 flex items-center justify-between border-b border-[var(--line)]">
        <div>
          <h2 className="font-medium text-[var(--ink)]">Notificações Pushbird</h2>
          <p className="text-xs text-[var(--ink-soft)]/60 mt-1">
            Cadastre um dispositivo por webhook do Pushbird e escolha quais notificações cada um recebe.
          </p>
        </div>
        {!mostrarForm && (
          <button type="button" onClick={() => setMostrarForm(true)} className="btn-primary px-3 py-1.5 text-sm shrink-0">
            + Dispositivo
          </button>
        )}
      </div>

      {mostrarForm && (
        <form
          action={async (formData) => {
            await criarPushbirdDevice(formData);
            setMostrarForm(false);
          }}
          className="p-4 space-y-3 border-b border-[var(--line)]"
        >
          <input name="nome" required placeholder="Nome do dispositivo (ex: celular do Erick)" className="input w-full" />
          <input name="webhookUrl" required placeholder="https://pushbird.app/..." className="input w-full" />
          <CamposNotificacao defaultConflito defaultCerco />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMostrarForm(false)} className="btn-link text-sm">
              Cancelar
            </button>
            <button className="btn-primary px-3 py-1.5 text-sm">Adicionar</button>
          </div>
        </form>
      )}

      <div className="divide-y divide-[var(--line)]">
        {devices.length === 0 ? (
          <p className="p-4 text-sm text-[var(--ink-soft)]/60">Nenhum dispositivo cadastrado.</p>
        ) : (
          devices.map((d) => <LinhaDispositivo key={d.id} device={d} />)
        )}
      </div>
    </div>
  );
}
