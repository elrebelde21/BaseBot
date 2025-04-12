import * as baileys from "@whiskeysockets/baileys";
import chalk from "chalk";
import readlineSync from "readline-sync";
import fs from "fs";
import pino from "pino";
import { db } from "./lib/postgres.ts";

const sessionFolder = "./session";
const credsPath = `${sessionFolder}/creds.json`;

if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

let usarCodigo = false;
let numero = "";

async function main() {
  console.clear();
  console.log(chalk.cyanBright.bold("══════════════════════════════"));
  console.log(chalk.magentaBright.bold("       InfinityBot v1.0"));
  console.log(chalk.cyanBright.bold("══════════════════════════════"));
  console.log(chalk.green("✅ PostgreSQL conectado"));

  // Si no hay credenciales guardadas, preguntar método de conexión (QR o código)
  if (!fs.existsSync(credsPath)) {
    console.log(chalk.green("1.") + " Conectar con código QR");
    console.log(chalk.green("2.") + " Conectar con código de 8 dígitos");

    const opcion = readlineSync.question(chalk.yellow("Elige una opción (1 o 2): "));
    usarCodigo = opcion === "2";

    if (usarCodigo) {
      numero = readlineSync.question(chalk.yellow("Ingresa tu número (ej: 5218144380378): "));
    }
  }

  startBot();
}

async function startBot() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState("session");
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.makeWASocket({
    version,
    printQRInTerminal: !usarCodigo && !fs.existsSync(credsPath),
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: baileys.makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    },
    browser: ["Ubuntu", "Chrome", "108.0.5359.125"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    const code = (lastDisconnect?.error as any)?.output?.statusCode;
    if (connection === "open") {
      console.log(chalk.greenBright("¡Conectado correctamente!"));     
    }
    if (connection === "close") {
      const reconectar = code !== baileys.DisconnectReason.loggedOut;
      console.log(chalk.red("Conexión cerrada. Código:"), code);
      if (reconectar) {
        console.log(chalk.blue("Reconectando..."));
        startBot();
      } else {
        console.log(chalk.redBright("Sesión finalizada. Borra la carpeta 'session' y vuelve a vincular."));
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    try {
      if (type !== "notify") return;  // solo manejar mensajes nuevos (no historial)
      // Procesar cada mensaje nuevo recibido
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;  // ignorar mensajes sin contenido o enviados por el propio bot
        const { handleMessage } = await import("./handler.ts");
        await handleMessage(sock, msg);  // delegar procesamiento del mensaje al handler general
      }
    } catch (err) {
      console.error(chalk.red("❌ Error procesando mensaje:"), err);
    }
  });

  // Si se eligió vinculación por código y aún no se ha registrado, generar el código de emparejamiento
  if (usarCodigo && !state.creds.registered && !fs.existsSync(credsPath)) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(numero);
        console.log(chalk.yellow("Código de emparejamiento (8 dígitos):"), chalk.greenBright.bold(code));
        console.log(chalk.gray("WhatsApp > Dispositivos vinculados > Vincular > Usar código"));
      } catch (e) {
        console.log(chalk.red("Error al generar el código:"), e);
      }
    }, 2500);
  }
}

main();
