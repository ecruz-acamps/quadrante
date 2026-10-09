import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { excluirUsuario } from "@/lib/actions";
import CriarUsuarioForm from "./CriarUsuarioForm";

export default async function UsuariosPage() {
  const atual = await requireRole("SUPER");
  const usuarios = await db.usuario.findMany({
    orderBy: { nome: "asc" },
    include: { missoes: { include: { missao: true } } },
  });
  const missoes = await db.missao.findMany({ orderBy: { id: "desc" } });
  const setores = (await db.setor.findMany({ orderBy: { nome: "asc" } })).map((s) => s.nome);

  return (
    <div className="max-w-2xl">
      <h1 className="page-title mb-6">Usuários</h1>

      <div className="card divide-y divide-[var(--line)] mb-8">
        {usuarios.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {u.nome}
                <span className="ml-2 text-[0.65rem] font-[var(--font-plex-mono)] text-[var(--brass)] border border-[var(--brass)]/40 rounded px-1 py-px align-middle">
                  {u.role}
                </span>
              </div>
              <div className="text-sm text-[var(--ink-soft)]/60">{u.email}</div>
              {u.role !== "SUPER" && (
                <div className="text-xs text-[var(--ink-soft)]/60 mt-0.5">
                  {u.role === "COORDENADOR" && <span className="mr-1 font-medium">{u.setor ?? "sem setor"} ·</span>}
                  {u.missoes.length > 0
                    ? u.missoes.map((v) => v.missao.nome).join(", ")
                    : "nenhuma missão vinculada"}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <a href={`/usuarios/${u.id}`} className="text-sm font-medium text-[var(--ink)] transition-colors hover:text-[var(--brass)]">
                Editar
              </a>
              {u.id !== atual.id && (
                <form action={excluirUsuario}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="btn-danger-link">Excluir</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-bold mb-3">Novo usuário</h2>
      <CriarUsuarioForm missoes={missoes} setores={setores} />
    </div>
  );
}
