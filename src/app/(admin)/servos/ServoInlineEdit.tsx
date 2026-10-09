"use client";

import { useState, useTransition } from "react";
import { atualizarServoInline } from "@/lib/actions";
import { CAMISETAS, FUNCOES, HORARIOS_CERCO, PAGAMENTOS } from "@/lib/constants";

type Dados = Parameters<typeof atualizarServoInline>[1];
type Opcao = { valor: string; rotulo: string };

const ERRO_REDE = "Não salvou. Verifique a conexão e tente de novo.";

// Select que salva ao mudar. Se o servidor recusar ou a rede falhar, volta ao valor anterior e avisa:
// nunca deixa a tela mostrando um valor que não foi gravado.
function InlineSelect({
  servoId,
  valorInicial,
  opcoes,
  paraDados,
  classe,
}: {
  servoId: number;
  valorInicial: string;
  opcoes: Opcao[];
  paraDados: (novo: string) => Dados;
  classe: (valor: string) => string;
}) {
  const [valor, setValor] = useState(valorInicial);
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();
  // valor antigo fora da lista (ex.: dado importado) continua aparecendo em vez de sumir
  const fora = valor !== "" && !opcoes.some((o) => o.valor === valor);

  function alterar(novo: string) {
    const anterior = valor;
    setValor(novo);
    setErro("");
    startTransition(async () => {
      try {
        const r = await atualizarServoInline(servoId, paraDados(novo));
        if (r.error) {
          setValor(anterior);
          setErro(r.error);
        }
      } catch {
        setValor(anterior);
        setErro(ERRO_REDE);
      }
    });
  }

  return (
    <div>
      <select
        value={valor}
        disabled={pending}
        aria-invalid={Boolean(erro)}
        onChange={(e) => alterar(e.target.value)}
        className={`qd-select ${classe(valor)}`}
      >
        {fora && <option value={valor}>{valor}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {erro && (
        <p role="alert" className="mt-1 text-[0.7rem] leading-tight text-[var(--signal)]">
          {erro}
        </p>
      )}
    </div>
  );
}

const VAZIO: Opcao = { valor: "", rotulo: "—" };
const simples = (v: string): Opcao => ({ valor: v, rotulo: v });

const TOM_FUNCAO: Record<string, string> = {
  COORDENADOR: "qd-tone-coord",
  AUXILIAR: "qd-tone-aux",
  APOIO: "qd-tone-apoio",
  INTEGRANTE: "qd-tone-integ",
};

export function CamisetaInlineSelect({ servoId, camiseta }: { servoId: number; camiseta: string | null }) {
  return (
    <InlineSelect
      servoId={servoId}
      valorInicial={camiseta ?? ""}
      opcoes={[VAZIO, ...CAMISETAS.map(simples)]}
      paraDados={(v) => ({ camiseta: v || null })}
      classe={() => "qd-tone-neutro"}
    />
  );
}

export function FuncaoInlineSelect({ servoId, funcao }: { servoId: number; funcao: string }) {
  return (
    <InlineSelect
      servoId={servoId}
      valorInicial={funcao}
      opcoes={FUNCOES.map(simples)}
      paraDados={(v) => ({ funcao: v })}
      classe={(v) => TOM_FUNCAO[v] ?? "qd-tone-neutro"}
    />
  );
}

export function CercoInlineSelect({ servoId, cercoHorario }: { servoId: number; cercoHorario: string | null }) {
  return (
    <InlineSelect
      servoId={servoId}
      valorInicial={cercoHorario ?? ""}
      opcoes={[VAZIO, ...HORARIOS_CERCO.map(simples)]}
      paraDados={(v) => ({ cercoHorario: v || null })}
      classe={() => "qd-tone-neutro"}
    />
  );
}

export function PagoInlineSelect({ servoId, pago }: { servoId: number; pago: boolean }) {
  return (
    <InlineSelect
      servoId={servoId}
      valorInicial={pago ? "sim" : "nao"}
      opcoes={[
        { valor: "sim", rotulo: "Sim" },
        { valor: "nao", rotulo: "Não" },
      ]}
      paraDados={(v) => ({ pago: v === "sim" })}
      classe={(v) => (v === "sim" ? "qd-tone-sim" : "qd-tone-nao")}
    />
  );
}

const ROTULO_PAGAMENTO: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  DÉBITO: "Débito",
  ISENTO: "Isento",
  "PAGO OUTRA MISSAO": "Pago em outra missão",
};

export function FormaPagamentoInlineSelect({ servoId, forma }: { servoId: number; forma: string | null }) {
  return (
    <InlineSelect
      servoId={servoId}
      valorInicial={forma ?? ""}
      opcoes={[VAZIO, ...PAGAMENTOS.map((p) => ({ valor: p, rotulo: ROTULO_PAGAMENTO[p] ?? p }))]}
      paraDados={(v) => ({ pagamentoForma: v || null })}
      classe={() => ""}
    />
  );
}
