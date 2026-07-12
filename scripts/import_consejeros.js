// ============================================================
// Carga del padrón de consejeros de MORENA para el
// "Desayuno Consejeros" (12-07-26). Evento independiente.
//
//  - Lee respaldos/consejeros_desayuno_12-07-26.xlsx (hoja única)
//  - Upsert en consejeros_desayuno (idempotente por `numero` = Dtto)
//
// Requisito previo: correr scripts/sql/004_consejeros_desayuno.sql
// Uso:
//   node scripts/import_consejeros.js            (carga)
//   node scripts/import_consejeros.js --dry      (solo mostrar, no escribe)
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

const DRY = process.argv.includes('--dry')
const ARCHIVO = 'respaldos/consejeros_desayuno_12-07-26.xlsx'

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Normaliza texto de celda: colapsa espacios y recorta.
const txt = v => (v == null ? '' : v.toString()).replace(/\s+/g, ' ').trim()

// Normaliza la confirmación a los tres valores canónicos.
function confirma(v) {
  const s = txt(v).toUpperCase()
  if (!s) return null
  if (s.startsWith('CONFIRMAD')) return 'Confirmado'
  if (s.startsWith('NO ASIST'))  return 'No asiste'
  if (s.startsWith('ENVIAD'))    return 'Enviado'
  return txt(v)
}

function filasExcel() {
  const wb = XLSX.readFile(ARCHIVO)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
  const filas = []
  // Estructura: [Dtto, DistritoFederal, MunicipioOrigen, Consejero, confirma, Teléfono, Obs]
  // Se saltan título (fila 0) y encabezado (fila 1). Las filas de resumen
  // al final (CONFIRMADOS/PENDIENTES/…) no tienen número en la col 0.
  for (const r of rows.slice(2)) {
    const numero = Number(r[0])
    const nombre = txt(r[3])
    // Descarta encabezados/vacíos y las filas de resumen del pie
    // (CONFIRMADOS/PENDIENTES/…), cuya col "Dtto" viene vacía → numero 0.
    if (txt(r[0]) === '' || !Number.isInteger(numero) || numero < 1 || !nombre) continue
    filas.push({
      numero,
      distrito:         txt(r[1]) || null,
      municipio_origen: txt(r[2]) || null,
      nombre,
      confirmacion:     confirma(r[4]),
      telefono:         txt(r[5]) || null,
      observaciones:    txt(r[6]) || null,
      asistio:          false,
    })
  }
  return filas
}

async function main() {
  console.log('🚀 Importando consejeros del desayuno (12-07-26)...')
  const filas = filasExcel()
  console.log(`📊 ${filas.length} consejeros en el Excel`)

  const conf = filas.reduce((a, f) => (a[f.confirmacion || 'Sin RSVP'] = (a[f.confirmacion || 'Sin RSVP'] || 0) + 1, a), {})
  console.log('   RSVP:', conf)
  const dist = [...new Set(filas.map(f => f.distrito))]
  console.log(`   Distritos: ${dist.length} — ${dist.join(', ')}`)

  if (DRY) {
    console.log('\n👀 --dry: no se escribe nada. Muestra de 3 filas:')
    console.log(filas.slice(0, 3))
    return
  }

  console.log('\n💾 Upsert en consejeros_desayuno (por numero)...')
  const batchSize = 100
  for (let i = 0; i < filas.length; i += batchSize) {
    const batch = filas.slice(i, i + batchSize)
    const { error } = await supabase
      .from('consejeros_desayuno')
      .upsert(batch, { onConflict: 'numero', ignoreDuplicates: false })
    if (error) {
      console.error(`❌ Error lote ${i}: ${error.message}`)
      process.exit(1)
    }
    console.log(`   ✅ ${Math.min(i + batchSize, filas.length)}/${filas.length}`)
  }

  console.log('\n✅ Consejeros cargados. Evento listo e independiente de presidentes.')
}

main().catch(e => { console.error('❌ Error fatal:', e); process.exit(1) })
