const handler = async (m, { conn }) => {
  m.reply("pong!")
}
handler.command = /^(test)$/i
export default handler
