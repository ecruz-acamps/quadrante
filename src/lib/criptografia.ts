// Criptografia simétrica (AES256) de arquivos via gpg. A senha vai por stdin, nunca em argumento de processo.
import { spawn } from "node:child_process";

const SENHA_MIN = 16;

function gpg(args: string[], senha: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("gpg", ["--batch", "--yes", "--quiet", "--pinentry-mode", "loopback", "--passphrase-fd", "0", ...args], {
      stdio: ["pipe", "ignore", "pipe"],
      // mensagens do gpg sempre em inglês: restaurarBackup distingue "senha errada" pelo texto do erro
      env: { ...process.env, LC_ALL: "C" },
    });
    let erro = "";
    p.stderr.on("data", (d) => (erro += d));
    p.on("error", reject);
    p.on("close", (codigo) =>
      codigo === 0 ? resolve() : reject(new Error(`gpg falhou (código ${codigo}): ${erro.trim().split("\n").slice(-1)[0]}`)),
    );
    p.stdin.end(`${senha}\n`);
  });
}

export async function criptografarArquivo(entrada: string, saida: string, senha: string) {
  if (senha.length < SENHA_MIN) throw new Error(`A senha de criptografia precisa ter ao menos ${SENHA_MIN} caracteres.`);
  await gpg(["--symmetric", "--cipher-algo", "AES256", "-o", saida, entrada], senha);
}

export async function descriptografarArquivo(entrada: string, saida: string, senha: string) {
  await gpg(["--decrypt", "-o", saida, entrada], senha);
}
