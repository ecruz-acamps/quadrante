import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { fundirPessoas, ignorarDuplicata } from "@/lib/actions";

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/\s+/g, " ");

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

type PessoaCandidata = {
  id: number;
  nome: string;
  cidade: string | null;
  servos: { missao: { nome: string } }[];
};

type Candidato = {
  p1: PessoaCandidata;
  p2: PessoaCandidata;
  motivo: string;
};

export default async function DuplicatasPage() {
  await requireRole("SUPER");

  const pessoas = await db.pessoa.findMany({
    select: { id: true, nome: true, cidade: true, servos: { select: { missao: { select: { nome: true } } } } },
    orderBy: { nome: "asc" },
  });
  const ignoradas = new Set(
    (await db.duplicataIgnorada.findMany()).map((d) => `${d.pessoa1Id}-${d.pessoa2Id}`)
  );

  // indexa por token (palavra >= 3 letras) para não comparar todo mundo com todo mundo
  const tokensDe = (nome: string) => normalizar(nome).split(" ").filter((t) => t.length >= 3);
  const porToken = new Map<string, number[]>();
  pessoas.forEach((p, i) => {
    for (const t of new Set(tokensDe(p.nome))) {
      if (!porToken.has(t)) porToken.set(t, []);
      porToken.get(t)!.push(i);
    }
  });

  const vistos = new Set<string>();
  const candidatos: Candidato[] = [];
  for (const indices of porToken.values()) {
    if (indices.length < 2 || indices.length > 60) continue; // tokens muito comuns não ajudam
    for (let a = 0; a < indices.length && candidatos.length < 150; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const p1 = pessoas[indices[a]], p2 = pessoas[indices[b]];
        const chave = `${Math.min(p1.id, p2.id)}-${Math.max(p1.id, p2.id)}`;
        if (vistos.has(chave) || ignoradas.has(chave)) continue;
        vistos.add(chave);

        const n1 = normalizar(p1.nome), n2 = normalizar(p2.nome);
        const t1 = new Set(tokensDe(p1.nome)), t2 = new Set(tokensDe(p2.nome));
        const comuns = [...t1].filter((t) => t2.has(t)).length;
        const jaccard = comuns / (t1.size + t2.size - comuns);

        const dist = levenshtein(n1, n2);
        let motivo: string | null = null;
        if (dist <= 2) motivo = "grafia quase idêntica";
        else if (jaccard >= 0.65 && comuns >= 2) motivo = "mesmas palavras no nome";
        else if (comuns >= 3) motivo = "3+ palavras em comum";
        if (motivo) candidatos.push({ p1, p2, motivo });
      }
    }
  }

  // casos mais prováveis primeiro
  const prioridade: Record<string, number> = { "grafia quase idêntica": 0, "mesmas palavras no nome": 1, "3+ palavras em comum": 2 };
  candidatos.sort((a, b) => prioridade[a.motivo] - prioridade[b.motivo]);

  const detalhe = (p: (typeof pessoas)[number]) => {
    const missoes = [...new Set(p.servos.map((s) => s.missao.nome))];
    return `${p.cidade ? p.cidade + " · " : ""}${missoes.length} ${missoes.length === 1 ? "missão" : "missões"}`;
  };

  return (
    <div>
      <h1 className="page-title mb-2">Possíveis Duplicatas</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-6">
        Pares de pessoas com nomes parecidos. <strong>Fundir</strong> junta os dois cadastros no nome escolhido
        (o histórico de missões é transferido). <strong>Não é duplicata</strong> esconde o par desta lista.
      </p>

      {candidatos.length === 0 && (
        <p className="text-[var(--ink-soft)]/60">Nenhuma duplicata em potencial encontrada. 🎉</p>
      )}

      <div className="space-y-3">
        {candidatos.map(({ p1, p2, motivo }) => (
          <div key={`${p1.id}-${p2.id}`} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--brass)] mb-2">{motivo}</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {[{ manter: p1, remover: p2 }, { manter: p2, remover: p1 }].map(({ manter, remover }) => (
                <form key={manter.id} action={fundirPessoas} className="flex items-center justify-between gap-2 border border-[var(--line)] rounded px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{manter.nome}</div>
                    <div className="text-xs text-[var(--ink-soft)]/60">{detalhe(manter)}</div>
                  </div>
                  <input type="hidden" name="manterId" value={manter.id} />
                  <input type="hidden" name="removerId" value={remover.id} />
                  <button className="btn-primary text-xs whitespace-nowrap">Manter este</button>
                </form>
              ))}
            </div>
            <form action={ignorarDuplicata} className="mt-2 text-right">
              <input type="hidden" name="pessoa1Id" value={p1.id} />
              <input type="hidden" name="pessoa2Id" value={p2.id} />
              <button className="text-xs text-[var(--ink-soft)]/60 hover:text-[var(--ink)] underline">
                Não é duplicata
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
