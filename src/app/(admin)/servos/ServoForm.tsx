import { db } from "@/lib/db";
import { CAMISETAS, FUNCOES, HORARIOS_CERCO, PAGAMENTOS } from "@/lib/constants";
import type { Pessoa, Servo } from "@prisma/client";
import NomeSetorAlerta from "./NomeSetorAlerta";

export default async function ServoForm({
  servo,
  pessoa,
  missaoId,
}: {
  servo?: Servo;
  pessoa?: Pessoa;
  missaoId?: number;
}) {
  const setores = await db.setor.findMany({ orderBy: { nome: "asc" } });
  const sel = "input";
  const simNao = (name: string, value?: string | null) => (
    <select name={name} defaultValue={value ?? ""} className={sel}>
      <option value="">—</option>
      <option value="SIM">SIM</option>
      <option value="Não">Não</option>
    </select>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {missaoId ? (
        <NomeSetorAlerta missaoId={missaoId} setores={setores.map((s) => s.nome)} />
      ) : (
        <>
          <label className="col-span-2 md:col-span-3 text-sm">
            Nome
            <input name="nome" required defaultValue={pessoa?.nome} className={sel} />
          </label>
        </>
      )}
      <label className="text-sm">
        CPF
        <input name="cpf" defaultValue={pessoa?.cpf ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Celular
        <input name="celular" defaultValue={pessoa?.celular ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Endereço
        <input name="endereco" defaultValue={pessoa?.endereco ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Bairro
        <input name="bairro" defaultValue={pessoa?.bairro ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Cidade
        <input name="cidade" defaultValue={pessoa?.cidade ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Paróquia
        <input name="paroquia" defaultValue={pessoa?.paroquia ?? ""} className={sel} />
      </label>
      {!missaoId && (
        <label className="text-sm">
          Setor
          <select name="setor" required defaultValue={servo?.setor} className={sel}>
            {setores.map((s) => (
              <option key={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm">
        Função
        <select name="funcao" defaultValue={servo?.funcao ?? "INTEGRANTE"} className={sel}>
          {FUNCOES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Camiseta
        <select name="camiseta" defaultValue={servo?.camiseta ?? ""} className={sel}>
          <option value="">—</option>
          {CAMISETAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Status
        <select name="status" defaultValue={servo?.status ?? "ATIVO"} className={sel}>
          <option value="ATIVO">ATIVO</option>
          <option value="RECUSOU">RECUSOU (falou não)</option>
          <option value="DESISTIU">DESISTIU</option>
        </select>
      </label>
      <label className="text-sm">
        Cerco (horário)
        <select name="cercoHorario" defaultValue={servo?.cercoHorario ?? ""} className={sel}>
          <option value="">NÃO TEM</option>
          {HORARIOS_CERCO.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        1° Formação
        {simNao("formacao1", servo?.formacao1)}
      </label>
      <label className="text-sm">
        2° Formação
        {simNao("formacao2", servo?.formacao2)}
      </label>
      <label className="text-sm">
        3° Formação
        {simNao("formacao3", servo?.formacao3)}
      </label>
      <label className="text-sm col-span-2">
        Motivo da falta (formação)
        <input name="motivoFalta" defaultValue={servo?.motivoFalta ?? ""} className={sel} />
      </label>
      <label className="text-sm">
        Pagamento (forma)
        <select name="pagamentoForma" defaultValue={servo?.pagamentoForma ?? ""} className={sel}>
          <option value="">—</option>
          {PAGAMENTOS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Valor pago (R$)
        <input name="pagamentoValor" type="number" step="0.01" defaultValue={servo?.pagamentoValor ?? ""} className={sel} />
      </label>
      <label className="text-sm flex items-end gap-2 pb-2">
        <input type="checkbox" name="pago" defaultChecked={servo?.pago} /> Pago
      </label>
      <label className="text-sm col-span-2 md:col-span-3">
        Observações
        <input name="observacoes" defaultValue={servo?.observacoes ?? ""} className={sel} />
      </label>
    </div>
  );
}
