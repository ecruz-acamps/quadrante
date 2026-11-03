"use client";

import { useActionState, useState } from "react";
import { atualizarUsuario } from "@/lib/actions";
import MissaoCheckboxes from "../MissaoCheckboxes";

export default function EditarUsuarioForm({
  usuario,
  missoes,
  setores,
}: {
  usuario: { id: number; nome: string; role: string; setor: string | null; missaoIds: number[] };
  missoes: { id: number; nome: string }[];
  setores: string[];
}) {
  const [state, action, pending] = useActionState(atualizarUsuario, null);
  const [role, setRole] = useState(usuario.role);

  return (
    <form action={action} className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input type="hidden" name="id" value={usuario.id} />
      <input name="nome" required defaultValue={usuario.nome} placeholder="Nome" className="input col-span-2" />
      <select name="role" className="input col-span-2" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="ADMIN">ADMIN (secretaria)</option>
        <option value="SERVO_SECRETARIA">SERVO-SECRETARIA (só servos, formação, tribos e fichas)</option>
        <option value="COORDENADOR">COORDENADOR (só o próprio setor)</option>
        <option value="SUPER">SUPER (acesso total)</option>
      </select>
      {role === "COORDENADOR" && (
        <select name="setor" required defaultValue={usuario.setor ?? ""} className="input col-span-2">
          <option value="" disabled>
            Setor do coordenador…
          </option>
          {setores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <MissaoCheckboxes missoes={missoes} selecionadas={usuario.missaoIds} />
      <input
        name="novaSenha"
        type="password"
        placeholder="Nova senha (deixe em branco para não alterar)"
        className="input col-span-2"
      />
      {state && "error" in state && state.error && (
        <p className="col-span-2 text-[var(--signal)] text-sm">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="col-span-2 text-sm text-[var(--ink-soft)]/70">Salvo.</p>
      )}
      <button disabled={pending} className="btn-primary px-4 py-2 col-span-2">
        {pending ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
