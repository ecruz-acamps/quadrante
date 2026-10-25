"use client";

import { useState, useTransition } from "react";
import { ativarPerguntaServir, moverPerguntaServir, salvarPerguntaServir } from "@/lib/actionsServir";
import { TIPOS_PERGUNTA, type PerguntaForm } from "@/lib/servirRespostas";

type PerguntaAdmin = PerguntaForm & { ativa: boolean; ordem: number; temRespostas: boolean };

const ROTULO_TIPO: Record<string, string> = {
  TEXTO_CURTO: "Texto curto",
  TEXTO_LONGO: "Texto longo",
  SIM_NAO: "Sim / Não",
  ESCOLHA_UMA: "Escolha uma opção",
  ESCOLHA_VARIAS: "Escolha várias opções",
  NUMERO: "Número",
  DATA: "Data",
};

function Formulario({ pergunta, onFechar }: { pergunta: PerguntaAdmin | null; onFechar: () => void }) {
  const [tipo, setTipo] = useState(pergunta?.tipo ?? "TEXTO_CURTO");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const escolha = tipo === "ESCOLHA_UMA" || tipo === "ESCOLHA_VARIAS";

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await salvarPerguntaServir(null, dados);
      if ("error" in r && r.error) setErro(r.error);
      else onFechar();
    });
  }

  return (
    <form onSubmit={enviar} className="card p-4 space-y-3 mb-4">
      {pergunta && <input type="hidden" name="id" value={pergunta.id} />}
      <label className="block text-sm">
        <span className="font-medium">Pergunta</span>
        <input name="titulo" required maxLength={200} defaultValue={pergunta?.titulo ?? ""} className="input mt-1" />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Tipo</span>
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as PerguntaForm["tipo"])}
          disabled={pergunta?.temRespostas}
          className="input mt-1"
        >
          {TIPOS_PERGUNTA.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO[t]}
            </option>
          ))}
        </select>
        {pergunta?.temRespostas && (
          <span className="text-xs text-[var(--ink-soft)]/70">
            Já tem respostas: o tipo não pode mudar. Crie outra pergunta e desative esta.
          </span>
        )}
      </label>
      {pergunta?.temRespostas && <input type="hidden" name="tipo" value={tipo} />}
      {escolha && (
        <>
          <label className="block text-sm">
            <span className="font-medium">Opções (uma por linha)</span>
            <textarea name="opcoes" rows={6} defaultValue={pergunta?.opcoes.join("\n") ?? ""} className="input mt-1" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="permiteOutra" defaultChecked={pergunta?.permiteOutra ?? false} />
            Permitir a resposta “Outra” em texto livre
          </label>
        </>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="obrigatoria" defaultChecked={pergunta?.obrigatoria ?? false} />
        Obrigatória
      </label>
      {erro && (
        <p role="alert" className="text-[var(--signal)] text-sm">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button disabled={pending} className="btn-primary px-4 py-2">
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={onFechar} className="btn-link px-4 py-2">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function EditorPerguntas({ perguntas }: { perguntas: PerguntaAdmin[] }) {
  const [editando, setEditando] = useState<PerguntaAdmin | "nova" | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div>
      {editando === null && (
        <button type="button" onClick={() => setEditando("nova")} className="btn-primary px-4 py-2 mb-4">
          Nova pergunta
        </button>
      )}
      {editando !== null && (
        <Formulario
          key={editando === "nova" ? "nova" : editando.id}
          pergunta={editando === "nova" ? null : editando}
          onFechar={() => setEditando(null)}
        />
      )}
      <ol className="space-y-2">
        {perguntas.map((p, i) => (
          <li key={p.id} className={`card p-3 flex items-start gap-3 ${p.ativa ? "" : "opacity-60"}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--ink)]">{p.titulo}</p>
              <p className="text-xs text-[var(--ink-soft)]/70">
                {ROTULO_TIPO[p.tipo]} · {p.obrigatoria ? "obrigatória" : "opcional"}
                {p.permiteOutra ? " · aceita “Outra”" : ""}
                {p.ativa ? "" : " · desativada"}
                {p.temRespostas ? " · tem respostas" : ""}
              </p>
            </div>
            <div className="flex gap-2 text-sm shrink-0">
              <button
                type="button"
                aria-label="Subir"
                disabled={i === 0}
                onClick={() => startTransition(() => moverPerguntaServir(p.id, "cima"))}
                className="btn-link"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Descer"
                disabled={i === perguntas.length - 1}
                onClick={() => startTransition(() => moverPerguntaServir(p.id, "baixo"))}
                className="btn-link"
              >
                ↓
              </button>
              <button type="button" onClick={() => setEditando(p)} className="btn-link">
                Editar
              </button>
              <button
                type="button"
                onClick={() => startTransition(() => ativarPerguntaServir(p.id, !p.ativa))}
                className="btn-link"
              >
                {p.ativa ? "Desativar" : "Ativar"}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
