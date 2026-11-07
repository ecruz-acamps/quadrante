// Depois de trocar o banco e o .env, o processo precisa reiniciar para relê-los.
// Sob o pm2 (autorestart) basta sair com sucesso; a resposta HTTP é enviada antes (atraso de 800 ms).
export function agendarReinicio(): void {
  setTimeout(() => process.exit(0), 800);
}
