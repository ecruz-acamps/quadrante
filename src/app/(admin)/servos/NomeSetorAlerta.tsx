"use client";

import { useState } from "react";
import { SETORES_SEM_ALERTA_CONSECUTIVO } from "@/lib/constants";
import ServoBusca from "./ServoBusca";

const ALERTA_ESPIRITUAL =
  "Não é saudável espiritualmente um servo servir por mais que 2 vezes no mesmo setor. Utilize seus dons em outro local, seja obediente. Obediência gera graça.";

type SetorConsecutivo = { setor: string; vezes: number } | null;

export default function NomeSetorAlerta({
  missaoId,
  setores,
  nomeInicial,
  setorInicial,
}: {
  missaoId: number;
  setores: string[];
  nomeInicial?: string;
  setorInicial?: string;
}) {
  const [nome, setNome] = useState(nomeInicial ?? "");
  const [setor, setSetor] = useState(setorInicial ?? setores[0] ?? "");
  const [setorConsecutivo, setSetorConsecutivo] = useState<SetorConsecutivo>(null);

  const mostrarAlerta =
    !!setorConsecutivo &&
    setorConsecutivo.vezes >= 2 &&
    setorConsecutivo.setor === setor &&
    !SETORES_SEM_ALERTA_CONSECUTIVO.includes(setor);

  return (
    <>
      <label className="col-span-2 md:col-span-3 text-sm">
        Nome
        <ServoBusca
          missaoId={missaoId}
          nome={nome}
          onChangeNome={(v) => {
            setNome(v);
            setSetorConsecutivo(null);
          }}
          onSelecionar={(p) => {
            setNome(p.nome);
            setSetorConsecutivo(p.setorConsecutivo ?? null);
          }}
        />
      </label>
      <label className="text-sm">
        Setor
        <select
          name="setor"
          required
          value={setor}
          onChange={(e) => setSetor(e.target.value)}
          className="input"
        >
          {setores.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {mostrarAlerta && (
        <div className="col-span-2 md:col-span-3 rounded border border-[var(--signal)]/50 bg-[var(--signal)]/10 px-3 py-2 text-sm text-[var(--signal)]">
          {ALERTA_ESPIRITUAL}
        </div>
      )}
    </>
  );
}
