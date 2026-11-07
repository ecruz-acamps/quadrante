import { test, after } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chamarAuxiliar, lerStatusTunel, ErroAuxiliar } from "./auxiliarTunel";

const dir = mkdtempSync(join(tmpdir(), "qd-aux-"));
after(() => rmSync(dir, { recursive: true, force: true }));

function script(nome: string, corpo: string): string[] {
  const caminho = join(dir, nome);
  writeFileSync(caminho, `#!/bin/bash\n${corpo}\n`);
  chmodSync(caminho, 0o755);
  return [caminho];
}

const TOKEN = "TOKEN-DO-TUNEL-123456789012345678901234567890123456789012345";

test("o stdin chega ao auxiliar pelo fluxo e NUNCA pelos argumentos", async () => {
  const base = script("eco.sh", 'echo "args:$*"; IFS= read -r l; echo "stdin:$l"');
  const saida = await chamarAuxiliar("ligar", TOKEN + "\n", base);
  assert.match(saida, /args:ligar/);
  assert.match(saida, new RegExp(`stdin:${TOKEN}`));
  assert.equal(saida.split("\n")[0].includes(TOKEN), false);
});

test("saída diferente de 0 rejeita com ErroAuxiliar em português, sem repetir o stdin", async () => {
  const base = script("falha.sh", 'cat >/dev/null; echo "token inválido" >&2; exit 2');
  await assert.rejects(chamarAuxiliar("ligar", TOKEN + "\n", base), (e: unknown) => {
    assert.ok(e instanceof ErroAuxiliar);
    assert.match(e.message, /auxiliar do túnel falhou/);
    assert.match(e.message, /token inválido/);
    assert.equal(e.message.includes(TOKEN), false);
    return true;
  });
});

test("programa inexistente rejeita com ErroAuxiliar", async () => {
  await assert.rejects(chamarAuxiliar("status", undefined, [join(dir, "nao-existe")]), ErroAuxiliar);
});

test("lerStatusTunel: ativo, inativo e indisponível", async () => {
  assert.deepEqual(await lerStatusTunel(script("ativo.sh", "echo ativo")), { disponivel: true, ativo: true });
  assert.deepEqual(await lerStatusTunel(script("inativo.sh", "echo inativo")), { disponivel: true, ativo: false });
  assert.deepEqual(await lerStatusTunel([join(dir, "nao-existe")]), { disponivel: false, ativo: false });
  assert.deepEqual(await lerStatusTunel(script("sudo-negado.sh", "exit 1")), { disponivel: false, ativo: false });
});
