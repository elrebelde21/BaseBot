import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { db } from "./lib/postgres.js";
import { logCommand, logError, logMessage, LogLevel } from "./lib/logger.ts";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsFolder = path.join(__dirname, "plugins");

// Cargar dinámicamente todos los plugins (.ts en desarrollo, .js en producción)
const pluginFiles = fs.readdirSync(pluginsFolder).filter(file => file.endsWith(".ts") || file.endsWith(".js"));
const plugins: any[] = [];

for (const file of pluginFiles) {
  const filePath = path.join(pluginsFolder, file);
  const importPath = pathToFileURL(filePath).href;
  try {
    const plugin = await import(importPath);
    if (plugin?.default?.command) {
      plugins.push(plugin.default);
      console.log(chalk.green(`✅ Plugin cargado: ${file}`));
    } else {
      console.log(chalk.yellow(`⚠️ Plugin sin comando válido: ${file}`));
    }
  } catch (err) {
    console.error(chalk.red(`❌ Error cargando plugin ${file}: ${err}`));
  }
}

export async function handleMessage(conn: any, m: any) {
  // Enriquecer el mensaje con información de contexto
  const chatId = m.key.remoteJid || "";
  m.isGroup = chatId.endsWith("@g.us");
  m.sender = m.key.participant || chatId;
  if (m.key.fromMe) {
    m.sender = conn.user?.id || m.sender;
  }
  if (typeof m.sender === "string") {
    // Normalizar sender JID (remover ID de dispositivo si existe)
    m.sender = m.sender.replace(/:\d+@/, "@");
  }
  // Función para responder fácilmente en el mismo chat
  m.reply = (text: string) => conn.sendMessage(chatId, { text }, { quoted: m });

  // Obtener texto del mensaje (manejar mensajes efímeros o viewOnce)
  const messageContent = m.message?.ephemeralMessage?.message 
                      || m.message?.viewOnceMessage?.message 
                      || m.message;
  const text = messageContent?.conversation 
            || messageContent?.extendedTextMessage?.text 
            || messageContent?.imageMessage?.caption 
            || messageContent?.videoMessage?.caption 
            || "";
  if (!text) return;  // si no hay texto (p. ej. mensaje sin cuerpo), no procesar

  // Verificar prefijo de comando (e.g. '/', '!', '.')
  const prefixes = ["/", "!", "."];
  const usedPrefix = prefixes.find(p => text.startsWith(p)) || "";
  if (!usedPrefix) return; 

  const withoutPrefix = text.slice(usedPrefix.length).trim();
  const [commandName, ...argsArr] = withoutPrefix.split(/\s+/);
  const command = (commandName || "").toLowerCase();
  const args = argsArr;  // array de argumentos después del comando

  // Buscar un plugin cuyo comando coincida
  for (const handler of plugins) {
    let match = false;
    if (handler.command instanceof RegExp) {
      match = handler.command.test(command);  // si el comando es regex
    } else if (typeof handler.command === "string") {
      match = handler.command.toLowerCase() === command;
    } else if (Array.isArray(handler.command)) {
      match = handler.command.map(c => c.toLowerCase()).includes(command);
    }
    if (!match) continue;  // no coincide este plugin, continuar con el siguiente

    // ===== Plugin encontrado, verificar permisos y contexto =====
    const isGroup = m.isGroup;
    const isPrivate = !m.isGroup;

    // Determinar si el remitente es owner (dueño del bot)
    let isOwner = false;
    if (Array.isArray(config.owner)) {
      // comparar JID completo o número sin dominio
      isOwner = config.owner.includes(m.sender) || config.owner.includes(m.sender.split("@")[0]);
    }

    let isAdmin = false;
    let isBotAdmin = false;
    if ((handler.admin || handler.Botadmin) && !isGroup) {
      return m.reply("❌ Solo en grupos.");  
    }
    if (handler.admin || handler.Botadmin) {
      try {
        const metadata = await conn.groupMetadata(chatId);
        const participants = metadata.participants || [];
        const adminIds = participants
          .filter(p => p.admin === "admin" || p.admin === "superadmin")
          .map(p => p.id);
        isAdmin = adminIds.includes(m.sender);
        const botId = conn.user?.id ? conn.user.id.replace(/:\d+@/, "@") : null;
        isBotAdmin = botId ? adminIds.includes(botId) : false;
      } catch (e) {
        console.error(chalk.red("❌ Error obteniendo datos del grupo:"), e);
        isAdmin = false;
        isBotAdmin = false;
      }
    }

    if (handler.owner && !isOwner) {
      return m.reply("❌ Solo el owner puede usar este comando.");
    }
    if (handler.admin && !isAdmin) {
      return m.reply("❌ Solo los admins pueden usar esto.");
    }
    if (handler.Botadmin && !isBotAdmin) {
      return m.reply("❌ El bot necesita ser admin.");
    }
    if (handler.group && !isGroup) {
      return m.reply("❌ Solo en grupos.");
    }
    if (handler.private && isGroup) {
      return m.reply("❌ Solo en privado.");
    }
    if (handler.register) {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(m.sender);
      if (!user) {
        return m.reply("❌ Necesitas registrarte primero con /reg");
      }
    }

    try {
      logCommand({
        sender: m.sender,
        chatId: m.key.remoteJid || "",
        isGroup: m.isGroup,
        command: command, 
        args: args
      });
      await handler(m, { conn, args, usedPrefix, command });
    } catch (err) {
      console.error(chalk.red(`❌ Error al ejecutar ${handler.command}: ${err}`));
      m.reply("❌ Error ejecutando el comando.");
    }
  }
}
