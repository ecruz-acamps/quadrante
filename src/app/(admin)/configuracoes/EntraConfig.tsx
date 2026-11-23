"use client";

import { useActionState, useState } from "react";
import { salvarEntraAction } from "./actionsEntra";

type Props = {
  tenantId: string;
  clientId: string;
  temSegredo: boolean;
  urlLogin: string;
  urlOneDrive: string;
  sugestao: { login: string; onedrive: string } | null; // a partir do endereço público do túnel
};

function Copiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!texto) return null;
  return (
    <button
      type="button"
      className="btn-link text-xs shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        } catch {
          // navegador sem permissão para copiar: a pessoa seleciona o texto
        }
      }}
    >
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

export default function EntraConfig({ tenantId, clientId, temSegredo, urlLogin, urlOneDrive, sugestao }: Props) {
  const [estado, salvar, salvando] = useActionState(salvarEntraAction, null);
  // campos controlados: depois de um envio o React limpa o formulário, e um erro apagaria o que foi digitado
  const [tenant, setTenant] = useState(tenantId);
  const [client, setClient] = useState(clientId);
  const [segredo, setSegredo] = useState("");
  const [login, setLogin] = useState(urlLogin || sugestao?.login || "");
  const [onedrive, setOnedrive] = useState(urlOneDrive || sugestao?.onedrive || "");
  const http = typeof window !== "undefined" && window.location.protocol === "http:";
  const configurado = Boolean(tenantId && clientId && temSegredo);

  return (
    <form action={salvar} className="card p-4 space-y-3">
      <p className="text-sm text-[var(--ink-soft)]/80">
        Aplicativo registrado no <strong>Microsoft Entra</strong>, usado pelo login &quot;Entrar com Microsoft&quot; e pelo OneDrive (fichas e
        backup). Copie os IDs da <em>Visão geral</em> do aplicativo e o <em>Valor</em> do segredo em <em>Certificados e segredos</em>.
      </p>
      <p className="text-xs text-[var(--ink-soft)]/70">Status: {configurado ? "configurado" : "não configurado"}</p>

      <label className="block text-sm">
        ID do diretório (locatário)
        <input name="tenantId" value={tenant} onChange={(e) => setTenant(e.target.value)} required placeholder="00000000-0000-0000-0000-000000000000" className="input mt-1 font-mono text-xs" autoComplete="off" />
      </label>
      <label className="block text-sm">
        ID do aplicativo (cliente)
        <input name="clientId" value={client} onChange={(e) => setClient(e.target.value)} required placeholder="00000000-0000-0000-0000-000000000000" className="input mt-1 font-mono text-xs" autoComplete="off" />
      </label>
      <label className="block text-sm">
        Segredo do cliente (Valor)
        <input
          name="segredo"
          type="password"
          value={segredo}
          onChange={(e) => setSegredo(e.target.value)}
          required={!temSegredo}
          placeholder={temSegredo ? "•••••••• gravado (deixe em branco para manter)" : "Cole o Valor do segredo"}
          className="input mt-1 font-mono text-xs"
          autoComplete="new-password"
        />
      </label>

      <div className="border-t border-[var(--line)] pt-3 space-y-2">
        <p className="text-xs text-[var(--ink-soft)]/70">
          Cadastre estes dois endereços no aplicativo, em <em>Autenticação</em>, como plataforma <strong>Web</strong> (iguais, letra por letra):
        </p>
        <label className="block text-sm">
          URI de retorno do login
          <span className="flex items-center gap-2 mt-1">
            <input name="urlLogin" value={login} onChange={(e) => setLogin(e.target.value)} required placeholder="https://SEU-ENDERECO/api/auth/microsoft/callback" className="input flex-1 font-mono text-xs" />
            <Copiar texto={login} />
          </span>
        </label>
        <label className="block text-sm">
          URI de retorno do OneDrive
          <span className="flex items-center gap-2 mt-1">
            <input name="urlOneDrive" value={onedrive} onChange={(e) => setOnedrive(e.target.value)} required placeholder="https://SEU-ENDERECO/api/onedrive/callback" className="input flex-1 font-mono text-xs" />
            <Copiar texto={onedrive} />
          </span>
        </label>
        {!sugestao && !login && (
          <p className="text-xs text-[var(--ink-soft)]/70">Ligue o acesso pela internet (aba Acesso) para estes campos virem preenchidos com o endereço público.</p>
        )}
      </div>

      {http && (
        <p className="text-xs text-[var(--signal)]">
          Você está em HTTP: o segredo trafega sem criptografia nesta rede. Prefira fazer isto pelo endereço https.
        </p>
      )}
      {estado?.erro && <p className="text-sm text-[var(--signal)]">{estado.erro}</p>}
      {estado?.ok && <p className="text-sm text-green-700">{estado.ok}</p>}
      <button disabled={salvando} className="btn-primary px-4 py-2">
        {salvando ? "Conferindo com a Microsoft…" : "Testar e salvar"}
      </button>
      <p className="text-xs text-[var(--ink-soft)]/70">
        Antes de gravar, o sistema confere diretório, aplicativo e segredo com a Microsoft; se algo estiver errado, nada é gravado. Vale na hora,
        sem reiniciar. Anote a validade do segredo: quando vencer, gere outro no Entra e cole aqui.
      </p>
    </form>
  );
}
