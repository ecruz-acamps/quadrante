"use client";

import { useEffect } from "react";

// Erro inesperado numa tela do sistema: mostra uma mensagem em português em vez da tela padrão do Next.
export default function ErroDaTela({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-xl">
      <h1 className="page-title mb-3">Algo deu errado</h1>
      <p className="mb-4 text-sm text-[var(--ink-soft)]/80">
        Não foi possível carregar esta tela. Seus dados não foram alterados. Tente de novo; se continuar, avise quem cuida do sistema
        {error.digest ? ` informando o código ${error.digest}` : ""}.
      </p>
      <button type="button" onClick={() => retry()} className="btn-primary px-4 py-2">
        Tentar de novo
      </button>
    </div>
  );
}
