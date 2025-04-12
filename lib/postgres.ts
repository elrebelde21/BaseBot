import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pkg

export const db = new Pool({
  connectionString: process.env.POSTGRES_URI
})

db.connect()
  .then(() => console.log("✅ PostgreSQL conectado"))
  .catch(err => console.error("❌ Error al conectar a PostgreSQL:", err))
