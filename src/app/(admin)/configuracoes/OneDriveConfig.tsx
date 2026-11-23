"use client";

import { useActionState } from "react";
import { definirPastaRaizAction, desconectarOneDriveAction, usarPastaPadraoAction } from "./actionsOneDrive";

type Props = {
  configurado: boolean; // ENTRA_* no .env
  conta: string | null;
  pasta: { nome: string; url: string | null } | null; // null = pasta "Quadrante" no OneDrive da conta
  aviso: string | undefined;
};

const AVISOS: Record<string, [string, boolean]> = {
  conectado: ["OneDrive conectado.", true],
  erro: ["Falha na autorização. Tente de novo.", false],
  "sem-refresh-token": ["A Microsoft não devolveu um acesso permanente. Confira se o app tem a permissão offline_access e tente de novo.", false],
  "sem-config": ["O aplicativo do Microsoft Entra ainda não foi configurado: preencha a aba Microsoft, em Configurações.", false],
};

export default function OneDriveConfig({ configurado, conta, pasta, aviso }: Props) {
  const [estado, definir, definindo] = useActionState(definirPastaRaizAction, null);
  const msg = aviso ? AVISOS[aviso] : undefined;
  return (
    <div className="card p-4 mt-4 space-y-3">
      <p className="text-sm text-[var(--ink-soft)]/80">
        <strong>OneDrive:</strong> guarda as fichas preenchidas (pasta da missão › Fichas e › Tribos › cor) e o backup diário
        (banco + .env, criptografados, pasta Backups). Autorize com a conta Microsoft que deve ficar dona dos arquivos.
      </p>
      {msg && <p className={`text-sm ${msg[1] ? "text-green-700" : "text-[var(--signal)]"}`}>{msg[0]}</p>}
      <p className="text-xs text-[var(--ink-soft)]/70">
        Status: {conta ? <>conectado como <strong>{conta}</strong></> : "não conectado"}
        {!configurado && <> · falta configurar o aplicativo na aba <a href="#microsoft" className="underline">Microsoft</a></>}
      </p>

      <div className="flex flex-wrap gap-2">
        <a href="/api/onedrive" className="inline-block rounded px-4 py-2 bg-[var(--brass)] text-[var(--ink)] font-medium">
          {conta ? "Reconectar OneDrive" : "Conectar OneDrive"}
        </a>
        {conta && (
          <form
            action={desconectarOneDriveAction}
            onSubmit={(e) => {
              if (!window.confirm("Desconectar o OneDrive? Os arquivos que já estão lá não são apagados, mas fichas e backups param de ser enviados.")) e.preventDefault();
            }}
          >
            <button className="rounded px-4 py-2 border border-[var(--line)] text-[var(--ink)]">Desconectar</button>
          </form>
        )}
      </div>

      {conta && (
        <div className="border-t border-[var(--line)] pt-3 space-y-2">
          <p className="text-sm text-[var(--ink)]">
            Pasta usada:{" "}
            {pasta ? (
              <>
                <strong>{pasta.nome}</strong>
                {pasta.url && (
                  <>
                    {" "}
                    (<a href={pasta.url} target="_blank" rel="noreferrer" className="underline">abrir</a>)
                  </>
                )}
              </>
            ) : (
              <>
                <strong>Quadrante</strong>, no OneDrive de {conta}
              </>
            )}
          </p>
          <form action={definir} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="link"
              type="url"
              required
              placeholder="Link de uma pasta do OneDrive ou do SharePoint"
              className="input flex-1"
            />
            <button disabled={definindo} className="rounded px-4 py-2 border border-[var(--brass)] text-[var(--ink)] font-medium">
              {definindo ? "Conferindo…" : "Usar esta pasta"}
            </button>
          </form>
          <p className="text-xs text-[var(--ink-soft)]/70">
            Para usar um site do SharePoint ou outra pasta: abra a pasta, use &quot;Copiar link&quot; e cole aqui. A conta conectada
            precisa poder editar essa pasta. Arquivos já enviados continuam onde estão.
          </p>
          {estado?.erro && <p className="text-sm text-[var(--signal)]">{estado.erro}</p>}
          {estado?.ok && <p className="text-sm text-green-700">{estado.ok}</p>}
          {pasta && (
            <form action={usarPastaPadraoAction}>
              <button className="text-xs underline text-[var(--ink-soft)]">Voltar para a pasta padrão (Quadrante no OneDrive da conta)</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
