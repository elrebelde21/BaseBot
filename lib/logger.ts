import chalk from "chalk"

export enum LogLevel {
  ERROR = 0,
  COMMAND = 1,
  MESSAGE = 2,
}

export const CURRENT_LOG_LEVEL = LogLevel.COMMAND  // Cambia a LogLevel.MESSAGE en desarrollo

// Log para comandos detectados
export function logCommand(details: {
  timestamp?: string,
  sender: string,
  chatId: string,
  isGroup: boolean,
  command: string,
  args: string[]
}) {
  if (CURRENT_LOG_LEVEL < LogLevel.COMMAND) return
  const ts = details.timestamp || new Date().toISOString()
  console.log(
    chalk.blue(`[COMMAND]\nFrom: ${details.sender}\nChat: ${details.isGroup ? "Grupo" : "Privado"} (${details.chatId})\nComando: ${details.command}`)
  )
}

// Log para mensajes (opcional en entornos de debug)
export function logMessage(details: {
  timestamp?: string,
  sender: string,
  chatId: string,
  isGroup: boolean,
  text: string
}) {
  if (CURRENT_LOG_LEVEL < LogLevel.MESSAGE) return
  const ts = details.timestamp || new Date().toISOString()
  console.log(
    chalk.gray(`[MESSAGE]\n${ts}\nFrom: ${details.sender}\nChat: ${details.isGroup ? "Grupo" : "Privado"} (${details.chatId})\nMensaje: ${details.text}`)
  )
}

// Log de errores
export function logError(error: any) {
  console.error(chalk.red(`[ERROR] ${new Date().toISOString()} | ${error}`))
}
