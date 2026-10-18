"use client";

import { useState, useTransition } from "react";
import {
  apagarEquipe,
  criarEquipe,
  fecharDistribuicao,
  limparFixacoes,
  marcarTemCarro,
  moverCasa,
  moverServoEquipe,
  reabrirDistribuicao,
  rodarSorteio,
  sugerirEquipes,
} from "@/lib/actionsEvangelizacao";

type Resultado = { ok: true } | { error: string };

function useRodar() {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const rodar = (fn: () => Promise<Resultado>) =>
    start(async () => {
      const r = await fn();
      setErro("error" in r ? r.error : null);
    });
  return { pending, erro, rodar };
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? <span className="text-xs text-[var(--signal)]">{texto}</span> : null;
}

type Botao = {
  rotulo: string;
  ocupado: string;
  acao: () => Promise<Resultado>;
  confirmar?: string;
  destaque?: boolean;
  desabilitado?: boolean;
};

function BotaoAcao({ rotulo, ocupado, acao, confirmar, destaque, desabilitado }: Botao) {
  const { pending, erro, rodar } = useRodar();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className={destaque ? "btn-primary px-4 py-2 text-sm" : "btn-link text-sm px-2 py-2"}
        disabled={pending || desabilitado}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return;
          rodar(acao);
        }}
      >
        {pending ? ocupado : rotulo}
      </button>
      <Erro texto={erro} />
    </span>
  );
}

export function BarraAcoes({
  missaoId,
  fechada,
  souSuper,
}: {
  missaoId: number;
  fechada: boolean;
  souSuper: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2 mb-6">
      <BotaoAcao
        destaque
        rotulo="Sugerir equipes"
        ocupado="Montando..."
        desabilitado={fechada}
        confirmar="Montar as equipes de novo? As equipes atuais, a troca de membros e as casas fixadas serão apagadas."
        acao={() => sugerirEquipes(missaoId)}
      />
      <BotaoAcao
        destaque
        rotulo="Sortear casas"
        ocupado="Sorteando..."
        desabilitado={fechada}
        confirmar="Sortear as casas? Só as casas fixadas à mão ficam onde estão."
        acao={() => rodarSorteio(missaoId)}
      />
      <BotaoAcao rotulo="Nova equipe" ocupado="Criando..." desabilitado={fechada} acao={() => criarEquipe(missaoId)} />
      <BotaoAcao
        rotulo="Limpar fixações"
        ocupado="Limpando..."
        desabilitado={fechada}
        acao={() => limparFixacoes(missaoId)}
      />
      {fechada ? (
        souSuper && (
          <BotaoAcao
            rotulo="Reabrir distribuição"
            ocupado="Reabrindo..."
            confirmar="Reabrir a distribuição para edição?"
            acao={() => reabrirDistribuicao(missaoId)}
          />
        )
      ) : (
        <BotaoAcao
          rotulo="Fechar distribuição"
          ocupado="Fechando..."
          confirmar="Fechar a distribuição? Depois disso ninguém mexe nas equipes e casas (só o SUPER reabre) e a impressão fica liberada."
          acao={() => fecharDistribuicao(missaoId)}
        />
      )}
    </div>
  );
}

export function CarroCheck({ servoId, valor, desabilitado }: { servoId: number; valor: boolean; desabilitado: boolean }) {
  const { pending, erro, rodar } = useRodar();
  return (
    <label className="inline-flex items-center gap-1 text-xs text-[var(--ink-soft)]">
      <input
        type="checkbox"
        checked={valor}
        disabled={pending || desabilitado}
        onChange={(e) => rodar(() => marcarTemCarro(servoId, e.target.checked))}
      />
      carro
      <Erro texto={erro} />
    </label>
  );
}

export function MoverSelect({
  tipo,
  id,
  atual,
  equipes,
  desabilitado,
}: {
  tipo: "servo" | "casa";
  id: number;
  atual: number | null;
  equipes: { id: number; nome: string }[];
  desabilitado: boolean;
}) {
  const { pending, erro, rodar } = useRodar();
  return (
    <span className="inline-flex flex-col">
      <select
        className="text-xs border border-[var(--line)] rounded px-1 py-0.5 bg-[var(--card)]"
        value={atual ?? ""}
        disabled={pending || desabilitado}
        aria-label={tipo === "servo" ? "Equipe do servo" : "Equipe da casa"}
        onChange={(e) => {
          const equipeId = e.target.value === "" ? null : Number(e.target.value);
          rodar(() => (tipo === "servo" ? moverServoEquipe(id, equipeId) : moverCasa(id, equipeId)));
        }}
      >
        <option value="">{tipo === "servo" ? "Sem equipe" : "Sem equipe (solta)"}</option>
        {equipes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
      <Erro texto={erro} />
    </span>
  );
}

export function ApagarEquipe({ equipeId, desabilitado }: { equipeId: number; desabilitado: boolean }) {
  const { pending, erro, rodar } = useRodar();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className="text-xs text-[var(--signal)]"
        disabled={pending || desabilitado}
        onClick={() => {
          if (window.confirm("Apagar esta equipe? Membros e casas ficam sem equipe.")) rodar(() => apagarEquipe(equipeId));
        }}
      >
        Apagar equipe
      </button>
      <Erro texto={erro} />
    </span>
  );
}
