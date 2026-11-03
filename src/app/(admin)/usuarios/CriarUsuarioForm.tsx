"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { criarUsuario } from "@/lib/actions";
import MissaoCheckboxes from "./MissaoCheckboxes";

export default function CriarUsuarioForm({
  missoes,
  setores,
}: {
  missoes: { id: number; nome: string }[];
  setores: string[];
}) {
  const [state, action, pending] = useActionState(criarUsuario, null);
  const [role, setRole] = useState("ADMIN");
  const formRef = useRef<HTMLFormElement>(null);

  // após criar com sucesso o form é resetado; o estado do select controlado precisa voltar junto
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (state && "ok" in state && state.ok) setRole("ADMIN");
  }

  useEffect(() => {
    if (state && "ok" in state && state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input name="nome" required placeholder="Nome" className="input col-span-2" />
      <input name="email" type="email" required placeholder="E-mail" className="input col-span-2" />
      <input name="senha" type="password" required placeholder="Senha" className="input" />
      <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="ADMIN">ADMIN (secretaria)</option>
        <option value="SERVO_SECRETARIA">SERVO-SECRETARIA (só servos, formação, tribos e fichas)</option>
        <option value="COORDENADOR">COORDENADOR (só o próprio setor)</option>
        <option value="SUPER">SUPER (acesso total)</option>
      </select>
      {role === "COORDENADOR" && (
        <select name="setor" required defaultValue="" className="input col-span-2">
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
      <MissaoCheckboxes missoes={missoes} selecionadas={[]} />
      {state && "error" in state && state.error && (
        <p className="col-span-2 text-[var(--signal)] text-sm">{state.error}</p>
      )}
      <button disabled={pending} className="btn-primary px-4 py-2 col-span-2">
        {pending ? "Criando..." : "Criar usuário"}
      </button>
    </form>
  );
}
