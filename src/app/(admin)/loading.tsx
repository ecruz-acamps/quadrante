// Feedback imediato ao trocar de tela (o servidor ainda está montando a página).
export default function Carregando() {
  return (
    <div className="max-w-xl" role="status" aria-live="polite">
      <div className="mb-4 h-8 w-56 animate-pulse rounded-lg bg-[#e8ebf3]" />
      <div className="mb-3 h-24 animate-pulse rounded-xl bg-[#eef0f6]" />
      <div className="h-24 animate-pulse rounded-xl bg-[#eef0f6]" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
