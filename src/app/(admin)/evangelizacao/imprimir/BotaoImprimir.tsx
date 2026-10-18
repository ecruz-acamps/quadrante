"use client";

export default function BotaoImprimir() {
  return (
    <button type="button" className="btn-primary px-4 py-2 text-sm print:hidden" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
