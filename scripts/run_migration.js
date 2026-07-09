// ============================================================
// Ejecuta un archivo .sql vía Supabase Management API.
// El token NUNCA se guarda: se lee de la variable de entorno SUPABASE_ACCESS_TOKEN.
//
// Uso (PowerShell):
//   $env:SUPABASE_ACCESS_TOKEN="sbp_xxx"; node scripts/run_migration.js scripts/sql/001_presidentes_municipales.sql
// Uso (bash):
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run_migration.js scripts/sql/001_presidentes_municipales.sql
// ============================================================
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config()

const token = process.env.SUPABASE_ACCESS_TOKEN
const sqlFile = process.argv[2] || 'scripts/sql/001_presidentes_municipales.sql'

// Deriva el project ref desde VITE_SUPABASE_URL (https://<ref>.supabase.co)
const url = process.env.VITE_SUPABASE_URL || ''
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]

if (!token) {
  console.error('❌ Falta SUPABASE_ACCESS_TOKEN (Personal Access Token sbp_...) en el entorno.')
  process.exit(1)
}
if (!ref) {
  console.error('❌ No pude derivar el project ref de VITE_SUPABASE_URL.')
  process.exit(1)
}

const sql = fs.readFileSync(sqlFile, 'utf-8')

async function main() {
  console.log(`🚀 Ejecutando ${sqlFile} en proyecto ${ref}...`)
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`❌ Error HTTP ${res.status}:`)
    console.error(text)
    process.exit(1)
  }
  console.log('✅ Migración ejecutada correctamente.')
  if (text && text.trim() && text.trim() !== '[]') {
    console.log('Respuesta:', text.slice(0, 500))
  }
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
