// Chama o auxiliar root do túnel (/usr/local/sbin/quadrante-tunel, instalado pelo install.sh) por `sudo -n`.
// Sem shell: o comando é fixo e o token vai pelo stdin, nunca em argumento (apareceria na lista de processos).
import { spawn } from "node:child_process";

const BASE_PADRAO = ["sudo", "-n", "/usr/local/sbin/quadrante-tunel"];

export type SubcomandoTunel = "ligar" | "desligar" | "status";

// Erros desta classe têm mensagem segura (sem token) e podem ser mostrados na tela.
export class ErroAuxiliar extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroAuxiliar";
  }
}

export function chamarAuxiliar(sub: SubcomandoTunel, stdin?: string, base: string[] = BASE_PADRAO): Promise<string> {
  return new Promise((resolve, reject) => {
    const [programa, ...args] = base;
    const p = spawn(programa, [...args, sub], { stdio: ["pipe", "pipe", "pipe"] });
    let saida = "";
    let erro = "";
    p.stdout.on("data", (d) => (saida += d));
    p.stderr.on("data", (d) => (erro += d));
    p.on("error", () => reject(new ErroAuxiliar("Não foi possível executar o auxiliar do túnel. Ele foi instalado pelo install.sh?")));
    p.on("close", (codigo) => {
      if (codigo === 0) return resolve(saida.trim());
      const motivo = erro.trim().split("\n").slice(-1)[0];
      reject(new ErroAuxiliar(`O auxiliar do túnel falhou${motivo ? `: ${motivo}` : "."}`));
    });
    p.stdin.on("error", () => {}); // o auxiliar pode sair antes de ler tudo
    p.stdin.end(stdin ?? "");
  });
}

export async function lerStatusTunel(base?: string[]): Promise<{ disponivel: boolean; ativo: boolean }> {
  try {
    return { disponivel: true, ativo: (await chamarAuxiliar("status", undefined, base)) === "ativo" };
  } catch {
    return { disponivel: false, ativo: false };
  }
}
