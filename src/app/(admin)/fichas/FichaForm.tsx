"use client";

import { useRef, useState } from "react";
import { PAGAMENTOS, CAMISETAS } from "@/lib/constants";
import { cepDeTexto, formatarCep, interpretarViaCep } from "@/lib/cep";
import type { Neocampista } from "@prisma/client";

export default function FichaForm({ ficha }: { ficha?: Neocampista }) {
  const sel = "input";
  const enderecoRef = useRef<HTMLInputElement>(null);
  const bairroRef = useRef<HTMLInputElement>(null);
  const cidadeRef = useRef<HTMLInputElement>(null);
  const consultaRef = useRef<AbortController | null>(null);
  const [cepMsg, setCepMsg] = useState<string | null>(null);

  // os campos são não controlados (defaultValue): preenche pelo ref, e só sobrescreve com o que o CEP trouxe
  async function buscarCep(texto: string) {
    const cep = cepDeTexto(texto);
    if (!cep) {
      consultaRef.current?.abort();
      setCepMsg(null);
      return;
    }
    consultaRef.current?.abort();
    const controle = new AbortController();
    consultaRef.current = controle;
    setCepMsg("Buscando CEP...");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controle.signal });
      if (!r.ok) throw new Error("falha");
      const dados = interpretarViaCep(await r.json());
      if (!dados) {
        setCepMsg("CEP não encontrado.");
        return;
      }
      if (dados.endereco && enderecoRef.current) enderecoRef.current.value = dados.endereco;
      if (dados.bairro && bairroRef.current) bairroRef.current.value = dados.bairro;
      if (cidadeRef.current) cidadeRef.current.value = dados.cidade;
      setCepMsg(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setCepMsg("Não foi possível consultar o CEP agora. Preencha o endereço à mão.");
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <label className="text-sm">
        Nº da ficha {ficha ? "*" : "(vazio = próximo)"}
        <input name="numero" type="number" min={1} required={!!ficha} defaultValue={ficha?.numero ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Núcleo
        <input name="nucleo" required defaultValue={ficha?.nucleo} className={sel} />
      </label>
      <label className="text-sm col-span-2">
        Nome
        <input name="nome" required defaultValue={ficha?.nome} className={sel} />
      </label>
      <label className="text-sm">
        CEP
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          className={sel}
          onChange={(e) => {
            e.target.value = formatarCep(e.target.value);
            buscarCep(e.target.value);
          }}
        />
        {cepMsg && <span className="block text-xs text-[var(--ink-soft)]/70 mt-1">{cepMsg}</span>}
      </label>
      <label className="text-sm">
        Endereço
        <input ref={enderecoRef} name="endereco" defaultValue={ficha?.endereco ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Bairro
        <input ref={bairroRef} name="bairro" defaultValue={ficha?.bairro ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Cidade
        <input ref={cidadeRef} name="cidade" defaultValue={ficha?.cidade ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Celular
        <input name="celular" defaultValue={ficha?.celular ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        CPF *
        <input name="cpf" required defaultValue={ficha?.cpf ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Idade
        <input name="idade" type="number" defaultValue={ficha?.idade ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Altura (m)
        <input name="altura" type="number" step="0.01" defaultValue={ficha?.altura ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Peso (kg)
        <input name="peso" type="number" step="0.1" defaultValue={ficha?.peso ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Sexo
        <select name="sexo" defaultValue={ficha?.sexo ?? ""} className={sel}>
          <option value="">—</option>
          <option value="MASCULINO">MASCULINO</option>
          <option value="FEMININO">FEMININO</option>
        </select>
      </label>
      <label className="text-sm">
        Camiseta
        <select name="camiseta" defaultValue={ficha?.camiseta ?? ""} className={sel}>
          <option value="">—</option>
          {CAMISETAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Pagamento
        <select name="pagamento" defaultValue={ficha?.pagamento ?? ""} className={sel}>
          <option value="">—</option>
          {PAGAMENTOS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Situação
        <select name="situacao" defaultValue={ficha?.situacao ?? "OK"} className={sel}>
          <option value="OK">OK</option>
          <option value="PENDENTE">PENDENTE</option>
          <option value="CANCELADO">CANCELADO</option>
        </select>
      </label>
      <label className="text-sm col-span-2 md:col-span-3">
        Observação
        <input name="observacao" defaultValue={ficha?.observacao ?? ""} className={sel} />
      </label>
    </div>
  );
}
