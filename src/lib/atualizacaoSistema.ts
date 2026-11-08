// Atualização do sistema pela interface: roda scripts/atualizar.sh em segundo plano e lê o registro dele.
// O script termina SEM reiniciar o app; reiniciar é um passo à parte (reiniciarSistema), pedido pela tela.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

export type EstadoAtualizacao = "parado" | "rodando" | "concluido" | "falhou";
export type StatusAtualizacao = { estado: EstadoAtualizacao; log: string; versao: string | null };

const MAX_LOG = 8000;

function pastaApp() {
  return process.cwd();
}
const caminhoLog = () => path.join(pastaApp(), "logs", "atualizacao.log");
const caminhoTrava = () => path.join(pastaApp(), "logs", "atualizacao.pid");

function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function rodando(): boolean {
  try {
    const pid = Number(fs.readFileSync(caminhoTrava(), "utf8").trim());
    return Number.isInteger(pid) && pid > 0 && processoVivo(pid);
  } catch {
    return false;
  }
}

export function estadoDoLog(texto: string, emExecucao: boolean): EstadoAtualizacao {
  if (emExecucao) return "rodando";
  const linhas = texto.trimEnd().split("\n");
  const ultima = linhas[linhas.length - 1] ?? "";
  if (ultima === "== CONCLUIDO ==") return "concluido";
  if (ultima === "== FALHOU ==") return "falhou";
  return texto.trim() === "" ? "parado" : "falhou"; // log sem terminador e sem processo: o script foi interrompido
}

export async function versaoAtual(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: pastaApp() });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function lerStatusAtualizacao(): Promise<StatusAtualizacao> {
  let texto = "";
  try {
    texto = fs.readFileSync(caminhoLog(), "utf8");
  } catch {
    // ainda não houve atualização
  }
  return { estado: estadoDoLog(texto, rodando()), log: texto.slice(-MAX_LOG), versao: await versaoAtual() };
}

// Devolve false se já há uma atualização em andamento.
export function iniciarAtualizacao(): boolean {
  if (rodando()) return false;
  fs.mkdirSync(path.join(pastaApp(), "logs"), { recursive: true });
  const fd = fs.openSync(caminhoLog(), "w");
  const filho = spawn("bash", [path.join(pastaApp(), "scripts", "atualizar.sh")], {
    cwd: pastaApp(),
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  if (filho.pid) fs.writeFileSync(caminhoTrava(), String(filho.pid));
  filho.on("error", () => {});
  filho.unref();
  return true;
}
