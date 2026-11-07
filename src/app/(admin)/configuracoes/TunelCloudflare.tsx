"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { ligarTunelAction, desligarTunelAction, type EstadoLigarTunel } from "./actionsTunel";

export default function TunelCloudflare({
  disponivel,
  ativo,
  hostname,
}: {
  disponivel: boolean;
  ativo: boolean;
  hostname: string | null;
}) {
  const [estado, acao, pendente] = useActionState<EstadoLigarTunel | null, FormData>(ligarTunelAction, null);
  const [token, setToken] = useState("");
  const [endereco, setEndereco] = useState(hostname ?? "");
  // protocolo da página (no servidor, false): só para avisar quando o token vai trafegar sem criptografia
  const http = useSyncExternalStore(
    () => () => {},
    () => window.location.protocol === "http:",
    () => false,
  );
  const [desligando, iniciarDesligar] = useTransition();
  const [erroDesligar, setErroDesligar] = useState<string | null>(null);

  if (!disponivel) {
    return (
      <div className="card p-4">
        <p className="text-sm text-[var(--ink-soft)]/80">
          O auxiliar do túnel não está instalado neste servidor. Rode o <code>install.sh</code> de novo para instalá-lo.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-4">
      <p className="text-sm text-[var(--ink-soft)]/80">
        Status: <strong>{ativo ? `ligado${hostname ? ` em https://${hostname}` : ""}` : "desligado (só pela rede local)"}</strong>
      </p>

      {ativo && (
        <div>
          <button
            type="button"
            disabled={desligando}
            onClick={() => {
              if (!window.confirm("Desligar o acesso pela internet? Depois disso o sistema só abre pela rede local.")) return;
              iniciarDesligar(async () => setErroDesligar((await desligarTunelAction()).erro ?? null));
            }}
            className="rounded px-4 py-2 border border-[var(--signal)]/30 text-[var(--signal)] font-medium"
          >
            {desligando ? "Desligando…" : "Desligar túnel"}
          </button>
          {erroDesligar && <p className="text-sm text-[var(--signal)] mt-2">{erroDesligar}</p>}
        </div>
      )}

      <form action={acao} className="space-y-3">
        <p className="text-sm text-[var(--ink-soft)]/80">
          {ativo ? "Para recriar ou trocar o endereço, informe o token de novo." : "Para liberar o acesso de qualquer lugar, informe:"}
        </p>
        <input
          name="tokenApi"
          type="password"
          autoComplete="off"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token da API da Cloudflare"
          className="input"
        />
        <input
          name="hostname"
          required
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Endereço público (ex.: quadrante.suaorganizacao.com.br)"
          className="input"
        />
        <details className="text-xs text-[var(--ink-soft)]/70">
          <summary className="cursor-pointer">Que permissões o token precisa?</summary>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Conta › Cloudflare Tunnel › Editar</li>
            <li>Zona › DNS › Editar</li>
            <li>Zona › Zona › Leitura</li>
          </ul>
          <p className="mt-1">O token é usado uma única vez e não fica guardado neste servidor.</p>
        </details>
        {http && (
          <p className="text-xs text-[var(--signal)]">
            Você está em HTTP: o token trafega sem criptografia nesta rede. Faça isto só numa rede em que você confie.
          </p>
        )}

        {estado?.erro && <p className="text-sm text-[var(--signal)]">{estado.erro}</p>}
        {estado?.ok && <p className="text-sm text-green-700">{estado.ok}</p>}

        {estado?.confirmar ? (
          <div className="rounded border border-[var(--signal)]/40 p-3 space-y-2">
            <p className="text-sm text-[var(--ink)]">
              <strong>{estado.confirmar.hostname}</strong> já aponta para outro lugar (<code>{estado.confirmar.tipo}</code> →{" "}
              <code>{estado.confirmar.conteudo}</code>). Trocar passa o acesso para <strong>este servidor</strong>; o servidor
              antigo deixa de receber visitas.
            </p>
            <input type="hidden" name="confirmarHostname" value={estado.confirmar.hostname} />
            <button name="confirmar" value="1" disabled={pendente} className="btn-primary px-4 py-2">
              {pendente ? "Trocando…" : "Trocar para este servidor"}
            </button>
          </div>
        ) : (
          <button disabled={pendente} className="btn-primary px-4 py-2">
            {pendente ? "Criando o túnel…" : "Criar túnel"}
          </button>
        )}
      </form>
    </div>
  );
}
