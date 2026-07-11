import { PAGAMENTOS, CAMISETAS } from "@/lib/constants";
import type { Neocampista } from "@prisma/client";

export default function FichaForm({ ficha }: { ficha?: Neocampista }) {
  const sel = "input";
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <label className="text-sm">
        Núcleo
        <input name="nucleo" required defaultValue={ficha?.nucleo} className={sel} />
      </label>
      <label className="text-sm col-span-2">
        Nome
        <input name="nome" required defaultValue={ficha?.nome} className={sel} />
      </label>
      <label className="text-sm">
        Endereço
        <input name="endereco" defaultValue={ficha?.endereco ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Bairro
        <input name="bairro" defaultValue={ficha?.bairro ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Cidade
        <input name="cidade" defaultValue={ficha?.cidade ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Celular
        <input name="celular" defaultValue={ficha?.celular ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        CPF
        <input name="cpf" defaultValue={ficha?.cpf ?? ""} className={sel} />
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
