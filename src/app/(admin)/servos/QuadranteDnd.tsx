"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { adicionarServoRapido, moverServo, solicitarLiberacaoConflito } from "@/lib/actions";

export const MIME_PESSOA = "application/x-quadrante-pessoa";
export const MIME_SERVO = "application/x-quadrante-servo";

type Conflito = {
  pessoaId: number;
  missaoId: number;
  missaoConflitoNome: string;
  distancia: number;
};

type Pendente = { pessoaId: number; nome: string; setor: string; conflito: Conflito };

type Ctx = {
  ativo: boolean; // só aceita soltar quando o painel de referência está aberto
  adicionar: (pessoaId: number, nome: string, setor: string) => Promise<void>;
  mover: (servoId: number, nome: string, setor: string) => Promise<void>;
};

const DndContext = createContext<Ctx>({ ativo: false, adicionar: async () => {}, mover: async () => {} });
export const useQuadranteDnd = () => useContext(DndContext);

// Centraliza a adição de um servo vindo do painel de referência (arrastar ou botão "+"),
// reaproveitando adicionarServoRapido e o fluxo de liberação por conflito de datas.
export function QuadranteDndProvider({
  missaoId,
  ativo,
  children,
}: {
  missaoId: number;
  ativo: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [codigo, setCodigo] = useState("");
  const [liberacaoSolicitada, setLiberacaoSolicitada] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = useCallback(
    async (pessoaId: number, nome: string, setor: string, codigoLiberacao?: string) => {
      setEnviando(true);
      const fd = new FormData();
      fd.set("missaoId", String(missaoId));
      fd.set("setor", setor);
      fd.set("pessoaId", String(pessoaId));
      if (codigoLiberacao) fd.set("codigoLiberacao", codigoLiberacao);
      const r = await adicionarServoRapido(fd);
      setEnviando(false);
      if (r && "conflito" in r && r.conflito) {
        setPendente({ pessoaId, nome, setor, conflito: r.conflito });
        return;
      }
      if (r && "error" in r && r.error) {
        setAviso({ tipo: "erro", texto: `${nome}: ${r.error}` });
        if (codigoLiberacao) return; // mantém o diálogo aberto para tentar outro código
        setPendente(null);
        return;
      }
      setPendente(null);
      setCodigo("");
      setLiberacaoSolicitada(false);
      setAviso({ tipo: "ok", texto: `${nome} adicionado(a) em ${setor}.` });
      router.refresh();
    },
    [missaoId, router],
  );

  const adicionar = useCallback(
    async (pessoaId: number, nome: string, setor: string) => {
      setAviso(null);
      setCodigo("");
      setLiberacaoSolicitada(false);
      await enviar(pessoaId, nome, setor);
    },
    [enviar],
  );

  const mover = useCallback(
    async (servoId: number, nome: string, setor: string) => {
      const r = await moverServo(servoId, setor);
      if (r.error) {
        setAviso({ tipo: "erro", texto: `${nome}: ${r.error}` });
        return;
      }
      setAviso({
        tipo: "ok",
        texto: `${nome} movido(a) para ${setor}.${r.funcaoAlterada ? " Já havia coordenador: virou integrante." : ""}`,
      });
      router.refresh();
    },
    [router],
  );

  function fecharDialogo() {
    setPendente(null);
    setCodigo("");
    setLiberacaoSolicitada(false);
  }

  return (
    <DndContext.Provider value={{ ativo, adicionar, mover }}>
      {children}

      {aviso && (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] rounded border px-4 py-2 text-sm shadow-lg bg-[var(--card)] ${
            aviso.tipo === "ok" ? "border-[var(--brass)] text-[var(--ink)]" : "border-[var(--signal)] text-[var(--signal)]"
          }`}
        >
          {aviso.texto}
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="ml-3 opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {pendente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-5 space-y-3">
            <h2 className="font-[var(--font-spectral)] text-lg text-[var(--ink)]">
              {pendente.nome} — {pendente.setor}
            </h2>
            <div className="border border-[var(--signal)] rounded p-3 text-sm space-y-2">
              <p>
                Já é servo ativo em <strong>{pendente.conflito.missaoConflitoNome}</strong>, a{" "}
                {pendente.conflito.distancia} mês(es) de distância.
              </p>
              {!liberacaoSolicitada ? (
                <button
                  type="button"
                  className="btn-primary px-3 py-1 text-sm"
                  onClick={async () => {
                    await solicitarLiberacaoConflito(pendente.pessoaId, pendente.conflito.missaoId);
                    setLiberacaoSolicitada(true);
                  }}
                >
                  Solicitar liberação da coordenação
                </button>
              ) : (
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Código de 6 dígitos"
                  className="input"
                  autoFocus
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={fecharDialogo} className="btn-link text-sm">
                Cancelar
              </button>
              {liberacaoSolicitada && (
                <button
                  type="button"
                  disabled={enviando || !codigo}
                  onClick={() => enviar(pendente.pessoaId, pendente.nome, pendente.setor, codigo)}
                  className="btn-primary px-4 py-1.5 text-sm"
                >
                  {enviando ? "Adicionando..." : "Adicionar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DndContext.Provider>
  );
}
