"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { removerArquivoFichaAction, removerParteFichaAction, sincronizarFichaAction } from "@/lib/actionsFichaArquivo";
import { prepararParaEnvio } from "./converterFoto";

const ACEITOS = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,image/*";

export type ParteNaTela = { nome: string; paginas: number };
// partes != null: o PDF único da ficha; null: arquivo solto de antes do PDF único
export type ArquivoNaTela = { id: number; nome: string; url: string | null; partes: ParteNaTela[] | null };

type Props = {
  fichaId: number;
  arquivos: ArquivoNaTela[];
  erro: string | null; // última falha ao sincronizar
  compacto?: boolean; // na linha da tabela de fichas
};

function faixa(partes: ParteNaTela[], i: number) {
  const inicio = partes.slice(0, i).reduce((n, p) => n + p.paginas, 0) + 1;
  const fim = inicio + partes[i].paginas - 1;
  return fim > inicio ? `páginas ${inicio}–${fim}` : `página ${inicio}`;
}

export default function ArquivoFicha({ fichaId, arquivos, erro, compacto }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ texto: string; ruim: boolean } | null>(null);
  const pdf = arquivos.find((a) => a.partes) ?? null;
  const paginas = pdf?.partes?.reduce((n, p) => n + p.paginas, 0) ?? 0;

  // um arquivo por vez, na ordem escolhida: cada um entra no fim do PDF da ficha
  async function enviar(lista: File[]) {
    setMensagem(null);
    const falhas: string[] = [];
    let enviados = 0;
    for (const [i, original] of lista.entries()) {
      setOcupado(lista.length > 1 ? `Enviando ${i + 1} de ${lista.length}…` : "Enviando…");
      try {
        const arquivo = await prepararParaEnvio(original);
        const corpo = new FormData();
        corpo.append("arquivo", arquivo);
        const res = await fetch(`/api/fichas/${fichaId}/arquivo`, { method: "POST", body: corpo });
        const r = (await res.json().catch(() => ({ erro: "resposta inesperada do servidor" }))) as { erro?: string; aviso?: string };
        if (r.erro) falhas.push(`${original.name}: ${r.erro}`);
        else {
          enviados++;
          if (r.aviso) falhas.push(`${original.name} foi enviado, mas: ${r.aviso}`);
        }
      } catch (e) {
        falhas.push(e instanceof Error ? e.message : `${original.name}: falha na conexão`);
      }
    }
    setOcupado(null);
    if (input.current) input.current.value = "";
    if (falhas.length) setMensagem({ texto: falhas.join(" · "), ruim: true });
    else setMensagem({ texto: enviados === 1 ? "Enviado e juntado ao PDF da ficha." : `${enviados} arquivos juntados ao PDF da ficha.`, ruim: false });
    router.refresh();
  }

  async function executar(acao: () => Promise<{ erro?: string }>, ok: string) {
    setOcupado("Atualizando…");
    const r = await acao().catch(() => ({ erro: "Falha na conexão." }));
    setOcupado(null);
    setMensagem(r.erro ? { texto: r.erro, ruim: true } : { texto: ok, ruim: false });
    router.refresh();
  }

  const seletor = (
    <input
      ref={input}
      type="file"
      multiple
      accept={ACEITOS}
      className="hidden"
      onChange={(e) => {
        const lista = Array.from(e.target.files ?? []);
        if (lista.length) enviar(lista);
      }}
    />
  );
  const botao = (texto: string, classe: string) => (
    <button type="button" disabled={Boolean(ocupado)} onClick={() => input.current?.click()} className={classe}>
      {ocupado ?? texto}
    </button>
  );
  const avisos = (
    <>
      {erro && !mensagem && (
        <span className="block text-xs text-[var(--signal)]" title={erro}>
          ⚠ Fora de ordem no OneDrive.{" "}
          <button type="button" disabled={Boolean(ocupado)} onClick={() => executar(() => sincronizarFichaAction(fichaId), "Arquivos em dia no OneDrive.")} className="underline">
            Tentar de novo
          </button>
        </span>
      )}
      {mensagem && <span className={`block text-xs ${mensagem.ruim ? "text-[var(--signal)]" : "text-green-700"}`}>{mensagem.texto}</span>}
    </>
  );

  if (compacto) {
    return (
      <div className="inline-flex flex-col items-end gap-1">
        {seletor}
        {arquivos.length > 0 && (
          <Link href={`/fichas/${fichaId}`} className="text-xs underline text-[var(--ink)]" title="Ver o PDF da ficha">
            {pdf ? `PDF · ${paginas} ${paginas === 1 ? "página" : "páginas"}` : `${arquivos.length} ${arquivos.length === 1 ? "arquivo" : "arquivos"}`}
          </Link>
        )}
        {botao(arquivos.length ? "Adicionar fotos ou PDF" : "Fazer upload da ficha preenchida", "btn-link text-xs")}
        {avisos}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {seletor}
      {arquivos.map((a) => (
        <div key={a.id} className="text-sm border border-[var(--line)] rounded">
          <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-[var(--paper)]">
            {a.url ? (
              <a href={a.url} target="_blank" rel="noreferrer" className="underline text-[var(--ink)] truncate font-medium" title="Abrir no OneDrive">
                {a.nome}
              </a>
            ) : (
              <span className="truncate font-medium">{a.nome}</span>
            )}
            {a.partes ? (
              <span className="text-xs text-[var(--ink-soft)]/70 shrink-0">
                {paginas} {paginas === 1 ? "página" : "páginas"}
              </span>
            ) : (
              <button
                type="button"
                disabled={Boolean(ocupado)}
                onClick={() => window.confirm(`Remover "${a.nome}"? Ele vai para a lixeira do OneDrive.`) && executar(() => removerArquivoFichaAction(a.id), "Arquivo removido.")}
                className="btn-danger-link text-xs shrink-0"
              >
                Remover
              </button>
            )}
          </div>
          {a.partes && (
            <ul className="divide-y divide-[var(--line)]">
              {a.partes.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-1 text-xs">
                  <span className="truncate text-[var(--ink-soft)]">
                    {faixa(a.partes!, i)}: {p.nome}
                  </span>
                  <button
                    type="button"
                    disabled={Boolean(ocupado)}
                    onClick={() =>
                      window.confirm(`Tirar "${p.nome}" (${faixa(a.partes!, i)}) do PDF da ficha?`) &&
                      executar(() => removerParteFichaAction(a.id, i), "Páginas removidas do PDF.")
                    }
                    className="btn-danger-link text-xs shrink-0"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {botao(arquivos.length ? "Adicionar mais fotos ou PDF" : "Fazer upload da ficha preenchida", "btn-primary px-4 py-2 text-sm")}
      <p className="text-xs text-[var(--ink-soft)]/70">
        Escolha as 2 fotos da ficha (frente e verso) de uma vez, na ordem: elas viram um PDF único, uma foto por página A4, pronto
        para imprimir. Aceita fotos (inclusive do iPhone) e PDF, até 10 MB cada.
      </p>
      {avisos}
    </div>
  );
}
