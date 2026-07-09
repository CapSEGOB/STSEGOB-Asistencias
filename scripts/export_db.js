// ============================================================
// Respaldo de la base de datos → archivos JSON en respaldos/
// Solo LECTURA. No modifica nada.
// Uso: node scripts/export_db.js
// ============================================================
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey  = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Falta VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Tablas a respaldar. Si alguna no existe todavía, se omite sin romper.
const TABLAS = ['asistentes', 'usuarios', 'presidentes_municipales']

async function exportarTabla(tabla, stamp) {
  // Paginar para no toparse con el límite de filas de PostgREST
  const pageSize = 1000
  let from = 0
  let all = []
  for (;;) {
    const { data, error } = await supabase
      .from(tabla)
      .select('*')
      .range(from, from + pageSize - 1)
    if (error) {
      if (/does not exist|not find the table/i.test(error.message)) {
        console.log(`   ⏭️  ${tabla}: no existe todavía, se omite`)
        return null
      }
      throw error
    }
    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  const file = `respaldos/backup_${tabla}_${stamp}.json`
  fs.writeFileSync(file, JSON.stringify(all, null, 2))
  console.log(`   ✅ ${tabla}: ${all.length} filas → ${file}`)
  return { tabla, filas: all.length, file }
}

async function main() {
  console.log('📦 Respaldando base de datos...')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resumen = []
  for (const t of TABLAS) {
    const r = await exportarTabla(t, stamp)
    if (r) resumen.push(r)
  }
  const indice = `respaldos/backup_INDICE_${stamp}.json`
  fs.writeFileSync(indice, JSON.stringify({ fecha: stamp, tablas: resumen }, null, 2))
  console.log(`\n✅ Respaldo completo. Índice: ${indice}`)
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
