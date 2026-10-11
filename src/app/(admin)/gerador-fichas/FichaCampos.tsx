"use client";

import { useState } from "react";

export type MissaoFicha = {
  id: number;
  nome: string;
  ano: number;
  dataInicio: string | null;
  dataFim: string | null;
  valorCampista: number;
  pixChave: string | null;
  contatoFinanceiro: string | null;
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// "2026-04-29" + "2026-05-03" → "29 de abril a 03 de maio de 2026"
function textoPeriodo(ini: string, fim: string) {
  const [ai, mi, di] = ini.split("-");
  const [af, mf, df] = fim.split("-");
  const mesI = MESES[Number(mi) - 1];
  const mesF = MESES[Number(mf) - 1];
  if (ai === af) return `${di} de ${mesI} a ${df} de ${mesF} de ${af}`;
  return `${di} de ${mesI} de ${ai} a ${df} de ${mesF} de ${af}`;
}

export default function FichaCampos({ missoes }: { missoes: MissaoFicha[] }) {
  const [v, setV] = useState({ missao: "", data: "", saida: "", encerramento: "", valor: "", pix: "", contato: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: e.target.value }));

  function escolher(id: string) {
    const m = missoes.find((x) => String(x.id) === id);
    if (!m) return;
    setV({
      missao: String(m.ano),
      data: m.dataInicio && m.dataFim ? textoPeriodo(m.dataInicio, m.dataFim) : "",
      saida: m.dataInicio ?? "",
      encerramento: m.dataFim ?? "",
      valor: String(m.valorCampista),
      pix: m.pixChave ?? "",
      contato: m.contatoFinanceiro ?? "",
    });
  }

  return (
    <>
      <label className="text-sm col-span-2">
        Preencher a partir da missão
        <select className="input mt-1" defaultValue="" onChange={(e) => escolher(e.target.value)}>
          <option value="">— escolha para preencher os campos abaixo —</option>
          {missoes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Número da missão
        <input name="missao" type="number" min={1} required placeholder="23" className="input" value={v.missao} onChange={set("missao")} />
      </label>
      <label className="text-sm">
        Quantidade de fichas
        <input name="quantidade" type="number" min={1} max={300} required placeholder="100" className="input" />
      </label>
      <label className="text-sm col-span-2">
        Data (abaixo do número da missão)
        <input name="data" required placeholder="29 de abril a 03 de maio de 2026" className="input" value={v.data} onChange={set("data")} />
      </label>
      <label className="text-sm">
        Saída (início da missão)
        <input name="saida" type="date" required className="input" value={v.saida} onChange={set("saida")} />
      </label>
      <label className="text-sm">
        Encerramento
        <input name="encerramento" type="date" required className="input" value={v.encerramento} onChange={set("encerramento")} />
      </label>
      <label className="text-sm">
        Valor da inscrição (R$)
        <input name="valor" type="number" min={1} step="0.01" required className="input" value={v.valor} onChange={set("valor")} />
      </label>
      <label className="text-sm">
        Chave PIX
        <input name="pix" required maxLength={120} className="input" value={v.pix} onChange={set("pix")} />
      </label>
      <label className="text-sm col-span-2">
        Telefone do Setor Financeiro
        <input name="contato" required maxLength={120} placeholder="(48) 99999-9999" className="input" value={v.contato} onChange={set("contato")} />
      </label>
      <label className="text-sm">
        Primeira ficha nº
        <input name="inicio" type="number" min={1} defaultValue={1} required className="input" />
      </label>
    </>
  );
}
