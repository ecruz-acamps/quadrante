"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "sans-serif", padding: "2rem" }}>
        <h1>Algo deu errado</h1>
        <p>O erro foi registrado. Recarregue a página e tente de novo.</p>
      </body>
    </html>
  );
}
