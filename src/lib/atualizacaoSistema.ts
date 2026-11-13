// Atualização do sistema pela interface.
//  - verificarDisponivel: consulta o GitHub (git fetch) de tempos em tempos e conta as alterações que ainda
//    não estão no ar; o menu mostra um selo em Configurações quando há alguma.
//  - iniciarAtualizacao: roda scripts/atualizar.sh em segundo plano. O script compila a versão nova em
//    .next-novo enquanto o sistema segue no ar com a .next atual.
//  - quando o script termina bem, o próprio app troca as pastas (.next -> .next-antigo, .next-novo -> .next)
//    e reinicia pelo pm2: só esses poucos segundos ficam fora do ar.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { agendarReinicio } from "./reiniciar";

const execFileAsync = promisify(execFile);

export type EstadoAtualizacao = "parado" | "rodando" | "concluido" | "falhou";
export type StatusAtualizacao = {
  estado: EstadoAtualizacao;
  log: string;
  versao: string | null; // versão no ar (7 caracteres)
  pronto: boolean; // há um build novo esperando para entrar no ar
};
export type Alteracao = { hash: string; titulo: string };
export type Disponivel = {
  verificadoEm: number | null; // ms
  quantidade: number; // alterações no GitHub que ainda não estão no ar
  alteracoes: Alteracao[];
  erro: string | null;
};

const MAX_LOG = 8000;
const MAX_ALTERACOES = 20;
export const INTERVALO_VERIFICACAO_MS = 30 * 60 * 1000;

const pastaApp = () => process.cwd();
const caminhoLog = () => path.join(pastaApp(), "logs", "atualizacao.log");
const caminhoTrava = () => path.join(pastaApp(), "logs", "atualizacao.pid");
const caminhoDisponivel = () => path.join(pastaApp(), "logs", "atualizacao-disponivel.json");
const pastaBuild = (nome: ".next" | ".next-novo" | ".next-antigo") => path.join(pastaApp(), nome);

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

// Saída de `git log --format=%h%x09%s` -> lista de alterações.
export function lerAlteracoes(saida: string): Alteracao[] {
  return saida
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("\t");
      return i === -1 ? { hash: l, titulo: "" } : { hash: l.slice(0, i), titulo: l.slice(i + 1) };
    });
}

export function precisaVerificar(verificadoEm: number | null, agora: number): boolean {
  return verificadoEm == null || agora - verificadoEm >= INTERVALO_VERIFICACAO_MS;
}

async function git(args: string[], timeout = 30_000): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: pastaApp(), timeout });
  return stdout.trim();
}

// Commit completo da versão que está no ar: gravado no build pelo script; sem ele, o commit atual.
async function versaoNoAr(): Promise<string | null> {
  try {
    const gravada = fs.readFileSync(path.join(pastaBuild(".next"), "QUADRANTE_VERSAO"), "utf8").trim();
    if (gravada) return gravada;
  } catch {
    // build feito antes desta funcionalidade
  }
  try {
    return (await git(["rev-parse", "HEAD"])) || null;
  } catch {
    return null;
  }
}

export async function versaoAtual(): Promise<string | null> {
  return (await versaoNoAr())?.slice(0, 7) ?? null;
}

function buildPronto(): boolean {
  const novo = pastaBuild(".next-novo");
  return fs.existsSync(path.join(novo, "BUILD_ID")) && fs.existsSync(path.join(novo, "QUADRANTE_VERSAO"));
}

export async function lerStatusAtualizacao(): Promise<StatusAtualizacao> {
  let texto = "";
  try {
    texto = fs.readFileSync(caminhoLog(), "utf8");
  } catch {
    // ainda não houve atualização
  }
  const emExecucao = rodando();
  return {
    estado: estadoDoLog(texto, emExecucao),
    log: texto.slice(-MAX_LOG),
    versao: await versaoAtual(),
    pronto: !emExecucao && buildPronto(),
  };
}

// ---------- há versão nova? ----------

export function lerDisponivel(): Disponivel {
  try {
    const d = JSON.parse(fs.readFileSync(caminhoDisponivel(), "utf8")) as Disponivel;
    return { verificadoEm: d.verificadoEm ?? null, quantidade: d.quantidade ?? 0, alteracoes: d.alteracoes ?? [], erro: d.erro ?? null };
  } catch {
    return { verificadoEm: null, quantidade: 0, alteracoes: [], erro: null };
  }
}

function gravarDisponivel(d: Disponivel) {
  fs.mkdirSync(path.dirname(caminhoDisponivel()), { recursive: true });
  fs.writeFileSync(caminhoDisponivel(), JSON.stringify(d));
}

let verificacaoEmCurso: Promise<Disponivel> | null = null;

// Consulta o GitHub e grava o resultado. Sem `forcar`, só consulta se a última verificação passou do intervalo.
export function verificarDisponivel(forcar = false): Promise<Disponivel> {
  const atual = lerDisponivel();
  if (!forcar && !precisaVerificar(atual.verificadoEm, Date.now())) return Promise.resolve(atual);
  if (rodando()) return Promise.resolve(atual); // o script já está buscando; dois git fetch ao mesmo tempo brigam pela trava
  if (verificacaoEmCurso) return verificacaoEmCurso;
  verificacaoEmCurso = (async () => {
    let d: Disponivel;
    try {
      const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
      await git(["fetch", "-q", "origin", branch]);
      const noAr = await versaoNoAr();
      if (!noAr) throw new Error("versão no ar desconhecida");
      const faixa = `${noAr}..origin/${branch}`;
      const quantidade = Number(await git(["rev-list", "--count", faixa])) || 0;
      const alteracoes = lerAlteracoes(await git(["log", "--no-merges", `-n${MAX_ALTERACOES}`, "--format=%h%x09%s", faixa]));
      d = { verificadoEm: Date.now(), quantidade, alteracoes, erro: null };
    } catch {
      // mantém o que já se sabia; a próxima tentativa fica para depois do intervalo
      d = { ...atual, verificadoEm: Date.now(), erro: "Não foi possível consultar o GitHub agora." };
    }
    try {
      gravarDisponivel(d);
    } catch {
      // sem permissão de escrita em logs/: segue sem guardar
    }
    return d;
  })().finally(() => {
    verificacaoEmCurso = null;
  });
  return verificacaoEmCurso;
}

// Para o menu: devolve o que já se sabe sem esperar e, se estiver velho, consulta em segundo plano.
export function quantidadeDisponivel(): number {
  const d = lerDisponivel();
  if (precisaVerificar(d.verificadoEm, Date.now())) verificarDisponivel().catch(() => {});
  return d.quantidade;
}

// ---------- atualizar ----------

// Troca o build no ar pelo novo e reinicia. Devolve false se não há build pronto.
export function aplicarAtualizacao(): boolean {
  if (rodando() || !buildPronto()) return false;
  const atual = pastaBuild(".next");
  const novo = pastaBuild(".next-novo");
  const antigo = pastaBuild(".next-antigo");
  fs.rmSync(antigo, { recursive: true, force: true });
  if (fs.existsSync(atual)) fs.renameSync(atual, antigo);
  try {
    fs.renameSync(novo, atual);
  } catch (e) {
    if (fs.existsSync(antigo)) fs.renameSync(antigo, atual); // desfaz: o sistema segue na versão anterior
    throw e;
  }
  // a versão nova já está no ar: zera o aviso de atualização disponível
  try {
    gravarDisponivel({ verificadoEm: Date.now(), quantidade: 0, alteracoes: [], erro: null });
  } catch {
    // sem permissão de escrita em logs/
  }
  agendarReinicio();
  return true;
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
  // terminou bem e deixou um build novo: entra no ar sozinho, mesmo com a tela fechada
  filho.on("exit", (codigo) => {
    try {
      fs.rmSync(caminhoTrava(), { force: true });
      if (codigo === 0) aplicarAtualizacao();
    } catch {
      // fica pronto; a tela oferece "Aplicar agora"
    }
  });
  filho.unref();
  return true;
}
