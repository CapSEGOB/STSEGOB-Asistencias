// ============================================================
// Carga de asistentes del "Consejo Estatal de Protección Civil".
//
//  - Lee respaldos/proteccion_civil.xlsx
//      hoja "PRESENCIALES" → modalidad 'presencial'
//      hoja "VÍA ZOOM"     → modalidad 'zoom'
//  - Inserta en pc_asistentes (borra e inserta con --reset)
//
// Requisito previo: correr scripts/sql/005_proteccion_civil.sql
// Uso:
//   node scripts/import_pc.js            (carga)
//   node scripts/import_pc.js --dry      (solo mostrar, no escribe)
//   node scripts/import_pc.js --reset    (vacía la tabla y recarga)
// ============================================================
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import * as XLSXmod from 'xlsx'
const XLSX = XLSXmod.default || XLSXmod

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey  = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Falta VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const DRY     = process.argv.includes('--dry')
const RESET   = process.argv.includes('--reset')
const ARCHIVO = 'respaldos/proteccion_civil.xlsx'

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const txt = v => (v == null ? '' : v.toString()).replace(/\s+/g, ' ').trim()

// El teléfono a veces llega como número (2311175114) → sin decimales.
const tel = v => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return String(Math.round(v))
  return txt(v) || null
}

function filasHoja(wb, hoja, modalidad) {
  const sheet = wb.Sheets[hoja]
  if (!sheet) { console.error(`❌ No existe la hoja "${hoja}"`); process.exit(1) }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
  const filas = []
  // Columnas: [CTVO, MICRORREGIÓN/REGION, MUNICIPIO, NOMBRE, TELEFONO, RESPONSABLE, CONFIRMACIÓN, OBSERVACIONES]
  for (const r of rows) {
    const numero = Number(r[0])
    const nombre = txt(r[3])
    if (!Number.isInteger(numero) || numero <= 0 || !nombre) continue // títulos/encabezados/resúmenes
    filas.push({
      numero,
      modalidad,
      microrregion:  txt(r[1]) || null,
      municipio:     txt(r[2]) || null,
      nombre,
      telefono:      tel(r[4]),
      responsable:   txt(r[5]) || null,
      confirmacion:  txt(r[6]) || null,
      observaciones: txt(r[7]) || null,
    })
  }
  return filas
}

async function main() {
  const wb = XLSX.readFile(ARCHIVO)
  const presenciales = filasHoja(wb, 'PRESENCIALES', 'presencial')
  const zoom = filasHoja(wb, wb.SheetNames.find(n => /ZOOM/i.test(n)), 'zoom')
  console.log(`📋 Presenciales: ${presenciales.length} | Zoom: ${zoom.length}`)

  if (DRY) {
    console.log(presenciales.slice(0, 3), '...')
    console.log(zoom.slice(0, 3), '...')
    return
  }

  if (RESET) {
    const { error } = await supabase.from('pc_asistentes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) { console.error('❌ Error al vaciar:', error.message); process.exit(1) }
    console.log('🧹 Tabla pc_asistentes vaciada.')
  }

  const todos = [...presenciales, ...zoom]
  for (let i = 0; i < todos.length; i += 200) {
    const { error } = await supabase.from('pc_asistentes').insert(todos.slice(i, i + 200))
    if (error) { console.error('❌ Error al insertar:', error.message); process.exit(1) }
  }
  console.log(`✅ Insertados ${todos.length} registros en pc_asistentes.`)
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
