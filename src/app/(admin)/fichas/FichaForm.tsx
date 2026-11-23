"use client";

import { useRef, useState } from "react";
import { PAGAMENTOS, CAMISETAS } from "@/lib/constants";
import { formatarCep, situacaoCep, type ResultadoCep } from "@/lib/cep";
import { NUCLEOS } from "@/lib/nucleos";
import { situacaoPermitida, exigeComprovante } from "@/lib/comprovante";
import type { Neocampista } from "@prisma/client";

export default function FichaForm({ ficha }: { ficha?: Neocampista }) {
  const sel = "input";
  const enderecoRef = useRef<HTMLInputElement>(null);
  const bairroRef = useRef<HTMLInputElement>(null);
  const cidadeRef = useRef<HTMLInputElement>(null);
  const consultaRef = useRef<AbortController | null>(null);
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  // PIX sem comprovante não pode ficar "OK - PAGO" (a mesma regra é conferida no servidor)
  const temComprovante = Boolean(ficha?.comprovanteItemId);
  const [pagamento, setPagamento] = useState(ficha?.pagamento ?? "");
  const [situacao, setSituacao] = useState(situacaoPermitida(ficha?.pagamento, ficha?.situacao ?? "OK", temComprovante));
  const bloqueiaOk = exigeComprovante(pagamento) && !temComprovante;

  // os campos são não controlados (defaultValue): preenche pelo ref, e só sobrescreve com o que o CEP trouxe
  async function buscarCep(cep: string) {
    consultaRef.current?.abort();
    const controle = new AbortController();
    consultaRef.current = controle;
    setCepMsg("Buscando CEP...");
    try {
      // o servidor consulta o ViaCEP e, se preciso, a BrasilAPI
      const r = await fetch(`/api/cep/${cep}`, { signal: controle.signal });
      const resp = (await r.json().catch(() => null)) as ResultadoCep | null;
      if (!resp || resp.tipo === "falhou" || !r.ok) throw new Error("falha");
      if (resp.tipo !== "encontrado") {
        setCepMsg(`CEP ${formatarCep(cep)} não encontrado. Confira os números.`);
        return;
      }
      const dados = resp.dados;
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
        <select name="nucleo" required defaultValue={ficha?.nucleo ?? ""} className={sel}>
          <option value="" disabled>
            Selecione o núcleo…
          </option>
          {/* ficha antiga com núcleo escrito de outro jeito: mantém o valor até alguém escolher um da lista */}
          {ficha?.nucleo && !(NUCLEOS as readonly string[]).includes(ficha.nucleo) && (
            <option value={ficha.nucleo}>{ficha.nucleo} (atual)</option>
          )}
          {NUCLEOS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
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
          maxLength={14}
          className={sel}
          onChange={(e) => {
            const s = situacaoCep(e.target.value);
            e.target.value = s.texto;
            if (s.tipo === "completo") return void buscarCep(s.cep);
            consultaRef.current?.abort();
            setCepMsg(s.tipo === "excesso" ? `CEP tem 8 dígitos; este tem ${s.digitos}. Confira os números.` : null);
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
        <select
          name="pagamento"
          value={pagamento}
          onChange={(e) => {
            setPagamento(e.target.value);
            setSituacao((atual) => situacaoPermitida(e.target.value, atual, temComprovante));
          }}
          className={sel}
        >
          <option value="">—</option>
          {PAGAMENTOS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Situação
        <select
          name="situacao"
          value={situacao}
          onChange={(e) => setSituacao(situacaoPermitida(pagamento, e.target.value, temComprovante))}
          className={sel}
        >
          <option value="OK" disabled={bloqueiaOk}>
            OK - PAGO{bloqueiaOk ? " (falta o comprovante do PIX)" : ""}
          </option>
          <option value="PENDENTE">PENDENTE</option>
          <option value="CANCELADO">CANCELADO</option>
        </select>
      </label>
      {bloqueiaOk && (
        <p className="col-span-2 md:col-span-3 rounded border border-[var(--brass)]/40 bg-[var(--brass)]/10 px-3 py-2 text-xs text-[var(--ink)]">
          Pagamento por <strong>PIX</strong>: a ficha fica <strong>PENDENTE</strong> até o comprovante ser enviado.{" "}
          {ficha ? (
            <a href={`/fichas/${ficha.id}#comprovante`} className="underline">
              Enviar o comprovante
            </a>
          ) : (
            "Salve a ficha e envie o comprovante na tela seguinte."
          )}
        </p>
      )}
      <label className="text-sm col-span-2 md:col-span-3">
        Observação
        <input name="observacao" defaultValue={ficha?.observacao ?? ""} className={sel} />
      </label>
    </div>
  );
}
