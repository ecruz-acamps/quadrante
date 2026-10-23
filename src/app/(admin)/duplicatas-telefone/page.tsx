import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { fundirPessoasPorTelefone, ignorarGrupoTelefone } from "@/lib/actions";

const soDigitos = (t: string) => {
  const d = t.replace(/\D/g, "");
  return d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
};

const STOP = new Set(["pe", "padre", "dos", "das", "de", "da", "do", "frei", "irma", "ir"]);
const tokens = (nome: string) =>
  new Set(
    nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? []
  );
const subconjunto = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));

export default async function DuplicatasTelefonePage() {
  await requireRole("SUPER");

  const [pessoas, neos, ignoradasDb] = await Promise.all([
    db.pessoa.findMany({
      where: { celular: { not: null } },
      select: { id: true, nome: true, celular: true, cidade: true, servos: { select: { missao: { select: { nome: true } } } } },
      orderBy: { nome: "asc" },
    }),
    db.neocampista.findMany({
      where: { celular: { not: null } },
      select: { id: true, nome: true, celular: true, numero: true, missao: { select: { nome: true } } },
    }),
    db.duplicataIgnorada.findMany(),
  ]);
  const ignoradas = new Set(ignoradasDb.map((d) => `${d.pessoa1Id}-${d.pessoa2Id}`));

  const grupos = new Map<string, { pessoas: typeof pessoas; neos: typeof neos }>();
  const grupo = (tel: string) => {
    if (!grupos.has(tel)) grupos.set(tel, { pessoas: [], neos: [] });
    return grupos.get(tel)!;
  };
  for (const p of pessoas) { const d = soDigitos(p.celular!); if (d.length >= 8) grupo(d).pessoas.push(p); }
  for (const n of neos) { const d = soDigitos(n.celular!); if (d.length >= 8) grupo(d).neos.push(n); }

  const lista = [...grupos.entries()]
    .filter(([, g]) => g.pessoas.length >= 2)
    // some se todos os pares do grupo já foram marcados como "não é duplicata"
    .filter(([, g]) =>
      g.pessoas.some((a, i) =>
        g.pessoas.slice(i + 1).some((b) => !ignoradas.has(`${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`))
      )
    )
    .map(([tel, g]) => {
      const ts = g.pessoas.map((p) => tokens(p.nome));
      let diferentes = false;
      for (let i = 0; i < ts.length; i++)
        for (let j = i + 1; j < ts.length; j++) {
          const comuns = [...ts[i]].filter((t) => ts[j].has(t)).length;
          if (!(subconjunto(ts[i], ts[j]) || subconjunto(ts[j], ts[i]) || comuns >= 2)) diferentes = true;
        }
      return { tel, ...g, diferentes };
    })
    .sort((a, b) => Number(a.diferentes) - Number(b.diferentes) || a.tel.localeCompare(b.tel));

  const detalhe = (p: (typeof pessoas)[number]) => {
    const missoes = [...new Set(p.servos.map((s) => s.missao.nome))];
    return `${p.cidade ? p.cidade + " · " : ""}${missoes.length} ${missoes.length === 1 ? "missão" : "missões"}`;
  };

  return (
    <div>
      <h1 className="page-title mb-2">Duplicatas por Telefone</h1>
      <p className="text-sm text-[var(--ink-soft)]/70 mb-6">
        Cadastros de pessoas que compartilham o mesmo celular. <strong>Manter este</strong> funde todos os outros do
        grupo neste cadastro (o histórico de missões é transferido). Casais e famílias costumam dividir o número:
        nesses casos use <strong>Não são a mesma pessoa</strong>. Grupos marcados como “nomes diferentes” pedem mais
        cuidado. Neocampistas com o mesmo número aparecem só como referência.
      </p>

      <p className="text-sm mb-4">{lista.length} {lista.length === 1 ? "grupo" : "grupos"}</p>
      {lista.length === 0 && <p className="text-[var(--ink-soft)]/60">Nenhum telefone repetido pendente. 🎉</p>}

      <div className="space-y-3">
        {lista.map((g) => (
          <div key={g.tel} className="card p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-xs uppercase tracking-wide text-[var(--brass)]">
                {g.diferentes ? "nomes diferentes" : "grafia parecida"} · {g.tel}
              </div>
            </div>
            <div className="space-y-2">
              {g.pessoas.map((manter) => (
                <form key={manter.id} action={fundirPessoasPorTelefone} className="flex items-center justify-between gap-2 border border-[var(--line)] rounded px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/pessoas/${manter.id}`} className="text-sm font-medium truncate hover:underline">{manter.nome}</Link>
                    <div className="text-xs text-[var(--ink-soft)]/60">{detalhe(manter)}</div>
                  </div>
                  <input type="hidden" name="manterId" value={manter.id} />
                  {g.pessoas.filter((o) => o.id !== manter.id).map((o) => (
                    <input key={o.id} type="hidden" name="removerId" value={o.id} />
                  ))}
                  <button className="btn-primary text-xs whitespace-nowrap">Manter este</button>
                </form>
              ))}
            </div>
            {g.neos.length > 0 && (
              <div className="mt-2 text-xs text-[var(--ink-soft)]/60">
                Neocampistas com este número:{" "}
                {g.neos.map((n) => `${n.nome} (${n.missao.nome}, ficha ${n.numero})`).join("; ")}
              </div>
            )}
            <form action={ignorarGrupoTelefone} className="mt-2 text-right">
              {g.pessoas.map((p) => <input key={p.id} type="hidden" name="pessoaId" value={p.id} />)}
              <button className="text-xs text-[var(--ink-soft)]/60 hover:text-[var(--ink)] underline">
                Não são a mesma pessoa
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
