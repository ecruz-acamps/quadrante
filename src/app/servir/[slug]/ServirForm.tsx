"use client";

import { useState, useTransition } from "react";
import { enviarCandidatura } from "@/lib/actionsServir";
import { OUTRA, type PerguntaForm } from "@/lib/servirRespostas";

type Resultado = Awaited<ReturnType<typeof enviarCandidatura>> | null;

function Campo({ rotulo, erro, children }: { rotulo: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="text-[var(--ink)] font-medium block">{rotulo}</span>
      {children}
      {erro && (
        <p role="alert" className="text-[var(--signal)] text-xs mt-1">
          {erro}
        </p>
      )}
    </div>
  );
}

function SimNao({ nome, obrigatorio, onChange }: { nome: string; obrigatorio?: boolean; onChange?: (v: string) => void }) {
  return (
    <div className="flex gap-4 mt-1">
      {["Sim", "Não"].map((v) => (
        <label key={v} className="flex items-center gap-2">
          <input type="radio" name={nome} value={v} required={obrigatorio} onChange={() => onChange?.(v)} />
          {v}
        </label>
      ))}
    </div>
  );
}

function PerguntaCampo({ p, erro }: { p: PerguntaForm; erro?: string }) {
  const nome = `p_${p.id}`;
  const rotulo = p.titulo + (p.obrigatoria ? " *" : "");
  const escolha = p.tipo === "ESCOLHA_UMA" || p.tipo === "ESCOLHA_VARIAS";
  return (
    <Campo rotulo={rotulo} erro={erro}>
      {p.tipo === "TEXTO_CURTO" && <input name={nome} maxLength={200} className="input mt-1" />}
      {p.tipo === "TEXTO_LONGO" && <textarea name={nome} maxLength={2000} rows={4} className="input mt-1" />}
      {p.tipo === "NUMERO" && <input name={nome} inputMode="numeric" maxLength={12} className="input mt-1" />}
      {p.tipo === "DATA" && <input name={nome} type="date" className="input mt-1" />}
      {p.tipo === "SIM_NAO" && <SimNao nome={nome} />}
      {escolha && (
        <div className="mt-1 space-y-1 max-h-72 overflow-auto">
          {p.opcoes.map((o) => (
            <label key={o} className="flex items-start gap-2">
              <input type={p.tipo === "ESCOLHA_UMA" ? "radio" : "checkbox"} name={nome} value={o} className="mt-1" />
              <span>{o}</span>
            </label>
          ))}
          {p.permiteOutra && (
            <div className="flex items-center gap-2">
              <input type={p.tipo === "ESCOLHA_UMA" ? "radio" : "checkbox"} name={nome} value={OUTRA} />
              <input name={`${nome}_outra`} placeholder="Outra:" maxLength={200} className="input" />
            </div>
          )}
        </div>
      )}
    </Campo>
  );
}

export default function ServirForm({
  missaoId,
  missaoNome,
  datas,
  perguntas,
}: {
  missaoId: number;
  missaoNome: string;
  datas: string | null;
  perguntas: PerguntaForm[];
}) {
  const [estado, setEstado] = useState<Resultado>(null);
  const [casado, setCasado] = useState("");
  const [pending, startTransition] = useTransition();
  const erros: Record<string, string> = (estado && "erros" in estado && estado.erros) || {};

  // envio por onSubmit (e não por action=) para o React não limpar os campos quando há erro de validação
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(async () => setEstado(await enviarCandidatura(null, dados)));
  }

  if (estado && "ok" in estado) {
    return (
      <div className="card p-6 text-center space-y-2" role="status">
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--brass)]">Resposta recebida</p>
        <h2 className="font-[var(--font-spectral)] text-2xl text-[var(--ink)]">Obrigado por se disponibilizar!</h2>
        <p className="text-sm text-[var(--ink-soft)]/80">A coordenação entrará em contato. Responder não garante vaga na equipe.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="card p-6 space-y-5">
      <input type="hidden" name="missaoId" value={missaoId} />

      <Campo rotulo="Nome completo *" erro={erros.nome}>
        <input name="nome" required maxLength={120} autoComplete="name" className="input mt-1" />
      </Campo>
      <Campo rotulo="CPF *" erro={erros.cpf}>
        <input name="cpf" required inputMode="numeric" maxLength={14} autoComplete="off" placeholder="000.000.000-00" className="input mt-1" />
      </Campo>
      <Campo rotulo="Telefone celular *" erro={erros.celular}>
        <input name="celular" required type="tel" maxLength={20} autoComplete="tel" placeholder="(48) 99999-0000" className="input mt-1" />
      </Campo>

      <Campo rotulo="Você é casado(a)? *" erro={erros.casado}>
        <SimNao nome="casado" obrigatorio onChange={setCasado} />
      </Campo>
      {casado === "Sim" && (
        <div className="space-y-5 border-l-2 border-[var(--brass)] pl-4">
          <Campo rotulo="Nome do cônjuge *" erro={erros.conjugeNome}>
            <input name="conjugeNome" required maxLength={120} className="input mt-1" />
          </Campo>
          <Campo rotulo="Celular do cônjuge *" erro={erros.conjugeCelular}>
            <input name="conjugeCelular" required type="tel" maxLength={20} placeholder="(48) 99999-0000" className="input mt-1" />
          </Campo>
        </div>
      )}

      {perguntas.map((p) => (
        <PerguntaCampo key={p.id} p={p} erro={erros[`p_${p.id}`]} />
      ))}

      <Campo rotulo={`Você pode servir no ${missaoNome}${datas ? ` - ${datas}` : ""}? *`} erro={erros.disponivel}>
        <SimNao nome="disponivel" obrigatorio />
      </Campo>

      <div className="text-xs text-[var(--ink-soft)]/80 space-y-2">
        <p>Responder não garante vaga na equipe.</p>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="lgpd" required className="mt-0.5" />
          <span>
            Concordo que a Associação dos Campistas São Padre Pio guarde meus dados para formar equipes de servos em
            acampamentos futuros, sem compartilhá-los com terceiros.
          </span>
        </label>
        {erros.lgpd && (
          <p role="alert" className="text-[var(--signal)]">
            {erros.lgpd}
          </p>
        )}
      </div>

      {estado && "error" in estado && estado.error && (
        <p role="alert" className="text-[var(--signal)] text-sm">
          {estado.error}
        </p>
      )}

      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Enviando..." : "Enviar"}
      </button>
    </form>
  );
}
