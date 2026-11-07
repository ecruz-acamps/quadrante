import bcrypt from "bcryptjs";
import { db } from "./db";
import { sistemaVazio } from "./sistemaVazio";

const SENHA_MIN = 10;

// "Começar do zero": cria o primeiro usuário (SUPER) de um sistema sem nenhum usuário.
export async function criarAdministrador(d: { nome: string; email: string; senha: string }): Promise<void> {
  const nome = d.nome.trim();
  const email = d.email.trim().toLowerCase();
  if (!nome) throw new Error("Informe o nome do administrador.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Informe um e-mail válido.");
  if (d.senha.length < SENHA_MIN) throw new Error(`A senha precisa ter ao menos ${SENHA_MIN} caracteres.`);
  if (!(await sistemaVazio())) throw new Error("O sistema já possui usuários.");
  await db.usuario.create({ data: { nome, email, senha: await bcrypt.hash(d.senha, 10), role: "SUPER" } });
}
