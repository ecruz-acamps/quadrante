"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { removerArquivoFichaAction, sincronizarFichaAction } from "@/lib/actionsFichaArquivo";

const ACEITOS = ".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx";

export type ArquivoNaTela = { id: number; nome: string; url: string | null };

type Props = {
  fichaId: number;
  arquivos: ArquivoNaTela[]; // na ordem
  erro: string | null; // última falha ao sincronizar
  compacto?: boolean; // na linha da tabela de fichas
};

export default function ArquivoFicha({ fichaId, arquivos, erro, compacto }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<string | null>(null); // texto do que está acontecendo
  const [mensagem, setMensagem] = useState<{ texto: string; ruim: boolean } | null>(null);

  // um arquivo por requisição: cada um pode ter até 10 MB e um erro não perde os outros
  async function enviar(lista: File[]) {
    setMensagem(null);
    const falhas: string[] = [];
    let enviados = 0;
    for (const [i, arquivo] of lista.entries()) {
      setOcupado(lista.length > 1 ? `Enviando ${i + 1} de ${lista.length}…` : "Enviando…");
      try {
        const corpo = new FormData();
        corpo.append("arquivo", arquivo);
        const res = await fetch(`/api/fichas/${fichaId}/arquivo`, { method: "POST", body: corpo });
        const r = (await res.json().catch(() => ({ erro: "resposta inesperada do servidor" }))) as { erro?: string; aviso?: string };
        if (r.erro) falhas.push(`${arquivo.name}: ${r.erro}`);
        else {
          enviados++;
          if (r.aviso) falhas.push(`${arquivo.name} foi enviado, mas: ${r.aviso}`);
        }
      } catch {
        falhas.push(`${arquivo.name}: falha na conexão`);
      }
    }
    setOcupado(null);
    if (input.current) input.current.value = "";
    if (falhas.length) setMensagem({ texto: falhas.join(" · "), ruim: true });
    else setMensagem({ texto: enviados === 1 ? "Arquivo enviado." : `${enviados} arquivos enviados.`, ruim: false });
    router.refresh();
  }

  async function remover(a: ArquivoNaTela) {
    if (!window.confirm(`Remover "${a.nome}"? Ele vai para a lixeira do OneDrive e os outros arquivos são renumerados.`)) return;
    setOcupado("Removendo…");
    const r = await removerArquivoFichaAction(a.id).catch(() => ({ erro: "Falha na conexão." }));
    setOcupado(null);
    setMensagem(r.erro ? { texto: r.erro, ruim: true } : { texto: "Arquivo removido.", ruim: false });
    router.refresh();
  }

  async function tentarDeNovo() {
    setOcupado("Conferindo…");
    const r = await sincronizarFichaAction(fichaId).catch(() => ({ erro: "Falha na conexão." }));
    setOcupado(null);
    setMensagem(r.erro ? { texto: r.erro, ruim: true } : { texto: "Arquivos em dia no OneDrive.", ruim: false });
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
          <button type="button" disabled={Boolean(ocupado)} onClick={tentarDeNovo} className="underline">
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
          <Link href={`/fichas/${fichaId}`} className="text-xs underline text-[var(--ink)]" title="Ver os arquivos">
            {arquivos.length === 1 ? "1 arquivo" : `${arquivos.length} arquivos`}
          </Link>
        )}
        {botao(arquivos.length ? "Adicionar arquivos" : "Fazer upload da ficha preenchida", "btn-link text-xs")}
        {avisos}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {seletor}
      {arquivos.length > 0 && (
        <ul className="text-sm divide-y divide-[var(--line)] border border-[var(--line)] rounded">
          {arquivos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer" className="underline text-[var(--ink)] truncate" title="Abrir no OneDrive">
                  {a.nome}
                </a>
              ) : (
                <span className="truncate">{a.nome}</span>
              )}
              <button type="button" disabled={Boolean(ocupado)} onClick={() => remover(a)} className="btn-danger-link text-xs shrink-0">
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      {botao(arquivos.length ? "Adicionar mais arquivos" : "Fazer upload da ficha preenchida", "btn-primary px-4 py-2 text-sm")}
      <p className="text-xs text-[var(--ink-soft)]/70">Pode escolher vários arquivos de uma vez (PDF ou fotos, até 10 MB cada).</p>
      {avisos}
    </div>
  );
}
