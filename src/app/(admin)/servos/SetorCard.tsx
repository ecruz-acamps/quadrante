"use client";

import { useEffect, useRef, useState } from "react";
import { MIME_PESSOA, MIME_SERVO, useQuadranteDnd } from "./QuadranteDnd";
import { Icon, setorVisual } from "./icons";
import { normalizarBusca } from "@/lib/busca";

// só vale a pena buscar dentro do setor quando a lista é longa
const MIN_PARA_BUSCA = 5;

export default function SetorCard({
  titulo,
  setor,
  quantidade,
  acao,
  iniciarAberto = false,
  children,
}: {
  titulo: string; // com `quantidade`, é só o nome do setor; sem ela, é exibido como veio (ex.: "NOME (3)")
  quantidade?: number;
  setor?: string; // destino de um nome solto sobre o card; sem ele o card não aceita soltar
  acao: React.ReactNode;
  iniciarAberto?: boolean; // por padrão o card nasce minimizado
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(iniciarAberto);
  const [sobre, setSobre] = useState(false);
  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState<number | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const comBusca = (quantidade ?? 0) > MIN_PARA_BUSCA;
  const { ativo, adicionar, mover } = useQuadranteDnd();
  const visual = setorVisual(setor ?? titulo);

  // esconde as linhas (renderizadas no servidor, marcadas com data-nome) que não casam com a busca;
  // devolve quantas continuam visíveis
  function filtrar(texto: string) {
    const termo = normalizarBusca(texto);
    let achadas = 0;
    lista.current?.querySelectorAll<HTMLElement>("[data-nome]").forEach((el) => {
      const casa = !termo || (el.dataset.nome ?? "").includes(termo);
      el.style.display = casa ? "" : "none";
      if (casa) achadas++;
    });
    return termo ? achadas : null;
  }

  // a lista é re-renderizada pelo servidor depois de editar um servo: reaplica o filtro sem mexer no estado
  useEffect(() => {
    filtrar(busca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  return (
    <div
      className={`mb-4 qd-surface overflow-hidden ${sobre ? "ring-2 ring-[var(--brass-bright)] border-transparent" : ""}`}
      onDragOver={(e) => {
        const servo = e.dataTransfer.types.includes(MIME_SERVO);
        if (!setor || !(servo || (ativo && e.dataTransfer.types.includes(MIME_PESSOA)))) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = servo ? "move" : "copy";
        setSobre(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false);
      }}
      onDrop={(e) => {
        setSobre(false);
        if (!setor) return;
        const movido = e.dataTransfer.getData(MIME_SERVO);
        if (movido) {
          e.preventDefault();
          try {
            const { servoId, nome, setorAtual } = JSON.parse(movido);
            if (typeof servoId === "number" && typeof nome === "string" && setorAtual !== setor) mover(servoId, nome, setor);
          } catch {
            /* dado de arrastar inválido: ignora */
          }
          return;
        }
        if (!ativo) return;
        const raw = e.dataTransfer.getData(MIME_PESSOA);
        if (!raw) return;
        e.preventDefault();
        try {
          const { pessoaId, nome } = JSON.parse(raw);
          if (typeof pessoaId === "number" && typeof nome === "string") adicionar(pessoaId, nome, setor);
        } catch {
          /* dado de arrastar inválido: ignora */
        }
      }}
    >
      <div className="flex items-center gap-2 pr-3 sm:pr-4">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="group flex flex-1 min-w-0 items-center gap-3 px-3 py-3 sm:px-4 text-left"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center text-[#8a92a8] transition-transform duration-200 group-hover:text-[var(--ink)] ${
              aberto ? "rotate-90" : ""
            }`}
          >
            <Icon name="chevron" className="h-4 w-4" />
          </span>
          <span className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex ${visual.cor}`}>
            <Icon name={visual.icone} className="h-[18px] w-[18px]" />
          </span>
          <span className="truncate text-[0.8125rem] font-semibold tracking-wide text-[var(--ink)]">{titulo}</span>
          {quantidade !== undefined && (
            <span className="shrink-0 rounded-full bg-[#eef1f8] px-2 py-0.5 font-[var(--font-plex-mono)] text-xs font-medium text-[var(--ink)]">
              {visiveis !== null ? `${visiveis} de ${quantidade}` : quantidade}
            </span>
          )}
        </button>
        {comBusca && (
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setVisiveis(filtrar(e.target.value));
              if (e.target.value) setAberto(true);
            }}
            placeholder="Buscar neste setor…"
            aria-label={`Buscar servo no setor ${titulo}`}
            className="qd-field hidden !w-40 shrink-0 !py-1.5 text-sm sm:block sm:!w-52"
          />
        )}
        {acao}
      </div>
      <div className="qd-collapse" data-open={aberto}>
        <div inert={!aberto}>
          <div ref={lista} className="border-t border-[#eef0f5]">
            {children}
            {visiveis === 0 && <p className="px-4 py-6 text-center text-sm text-[#697089]">Nenhum servo encontrado neste setor.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
