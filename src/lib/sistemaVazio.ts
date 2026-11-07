import { db } from "./db";

// "Sistema vazio" = nenhum usuário cadastrado. Só nesse estado a tela /restaurar existe.
export async function sistemaVazio(): Promise<boolean> {
  return (await db.usuario.count()) === 0;
}
