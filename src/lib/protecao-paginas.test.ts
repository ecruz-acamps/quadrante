import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// roda a partir da raiz do app (npm test)
const RAIZ = join(process.cwd(), "src", "app", "(admin)");
const EXIGE_AUTH = /\b(requireUser|requireRole|requireCoordenador)\(/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return nome === "page.tsx" || nome === "route.ts" ? [caminho] : [];
  });
}

// remove comentários de bloco e de linha, para que uma chamada comentada não satisfaça a regex
// (aproximação: não trata "//" dentro de strings, ex. URLs, o que só remove texto a mais)
function semComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("semComentarios ignora chamadas comentadas", () => {
  assert.ok(!EXIGE_AUTH.test(semComentarios("// await requireUser();")));
  assert.ok(!EXIGE_AUTH.test(semComentarios("/* await requireRole(\"SUPER\");\n */")));
  assert.ok(EXIGE_AUTH.test(semComentarios("// nota\nawait requireUser(); // ok")));
});

test("toda página e rota de (admin) confere o usuário por conta própria", () => {
  const todos = arquivos(RAIZ);
  assert.ok(todos.length >= 20, `varredura achou só ${todos.length} arquivos; caminho errado?`);
  const sem = todos
    .filter((f) => !EXIGE_AUTH.test(semComentarios(readFileSync(f, "utf8"))))
    .map((f) => relative(RAIZ, f));
  assert.deepEqual(sem, [], `sem requireUser/requireRole: ${sem.join(", ")}`);
});

test("meu-setor/page.tsx usa requireCoordenador e não requireUser", () => {
  const codigo = semComentarios(readFileSync(join(RAIZ, "meu-setor", "page.tsx"), "utf8"));
  assert.ok(/\brequireCoordenador\(/.test(codigo), "meu-setor/page.tsx deve chamar requireCoordenador(");
  assert.ok(!/\brequireUser\(/.test(codigo), "requireUser em meu-setor redireciona o coordenador em loop");
});
