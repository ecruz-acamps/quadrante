import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="max-w-xl">
      <h1 className="page-title mb-3">Não encontrado</h1>
      <p className="mb-4 text-sm text-[var(--ink-soft)]/80">
        Este registro não existe ou você não tem acesso a ele.
      </p>
      <Link href="/" className="btn-primary inline-block px-4 py-2">
        Voltar ao início
      </Link>
    </div>
  );
}
