// ============================================================
// Aplica el Excel de la gira (4 pestañas) al padrón cargado.
//  - Cruza por MUNICIPIO (normalizado, sin acentos).
//  - Asigna: dia, telefono, responsable, confirmacion, observaciones.
//  - Sobrescribe `nombre` con el del Excel (lista operativa real).
//  - Donde el Excel trae OTRA persona (bajo solape de nombre): borra foto_url y partido.
//  - Los municipios del padrón que no están en el Excel quedan con dia = null.
//
// Uso:  node scripts/merge_excel.js          (aplica cambios)
//       node scripts/merge_excel.js --dry     (solo simula, no escribe)
// ============================================================
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import * as XLSXmod from 'xlsx'
const XLSX = XLSXmod.default || XLSXmod

dotenv.config()
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DRY = process.argv.includes('--dry')
const SHEET_DIA = { JUEVES: 1, VIERNES: 2, LUNES: 3, MARTES: 4 }
const UMBRAL_SOLAPE = 0.6 // < esto = persona distinta

const norm = t => (t || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const normNombre = t => (t || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = t => new Set(normNombre(t).split(' ').filter(x => x.length > 2))
function solape(a, b) {
  const A = tokens(a), B = tokens(b)
  if (!A.size || !B.size) return 0
  let inter = 0; for (const x of A) if (B.has(x)) inter++
  return inter / Math.min(A.size, B.size)
}
const limpiaTel = t => (t || '').toString().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ').trim() || null
const oNull = v => { const x = (v || '').toString().trim(); return x || null }

function filasExcel() {
  const wb = XLSX.readFile('respaldos/presidentes.xlsx')
  const filas = []
  for (const sheet of wb.SheetNames) {
    const dia = SHEET_DIA[sheet.toUpperCase()]
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false, defval: '' })
    for (const r of rows.slice(2)) {
      const municipio = (r[1] || '').toString().trim()
      const nombre = (r[2] || '').toString().replace(/\s+/g, ' ').trim()
      if (!municipio && !nombre) continue
      filas.push({
        dia, sheet, municipio, nombre,
        telefono: limpiaTel(r[3]),
        responsable: oNull(r[4]),
        confirmacion: oNull(r[5]),
        observaciones: oNull(r[6]),
      })
    }
  }
  return filas
}

async function main() {
  console.log(DRY ? '🧪 SIMULACIÓN (no escribe)\n' : '✍️  Aplicando Excel al padrón\n')
  const filas = filasExcel()
  const { data: padron } = await s.from('presidentes_municipales').select('id,municipio,nombre,foto_url,partido')
  const idx = new Map(padron.map(p => [norm(p.municipio), p]))

  let ok = 0, distintos = [], sinPadron = []
  for (const f of filas) {
    const p = idx.get(norm(f.municipio))
    if (!p) { sinPadron.push(f); continue }

    const esDistinto = normNombre(f.nombre) !== normNombre(p.nombre) && solape(f.nombre, p.nombre) < UMBRAL_SOLAPE
    const update = {
      nombre: f.nombre,
      dia: f.dia,
      telefono: f.telefono,
      responsable: f.responsable,
      confirmacion: f.confirmacion,
      observaciones: f.observaciones,
    }
    if (esDistinto) {
      update.foto_url = null
      update.partido = null
      distintos.push({ municipio: p.municipio, de: p.nombre, a: f.nombre })
    }

    if (!DRY) {
      const { error } = await s.from('presidentes_municipales').update(update).eq('id', p.id)
      if (error) { console.error(`❌ ${p.municipio}: ${error.message}`); continue }
    }
    ok++
  }

  const enExcel = new Set(filas.map(f => norm(f.municipio)))
  const sinDia = padron.filter(p => !enExcel.has(norm(p.municipio)))

  console.log(`✅ Actualizados: ${ok}/${filas.length}`)
  console.log(`\n🧹 Persona distinta (foto y partido borrados): ${distintos.length}`)
  distintos.forEach(d => console.log(`   ${d.municipio}: ${d.de} → ${d.a}`))
  console.log(`\n📌 Sin día (no aparecen en el Excel): ${sinDia.length}`)
  sinDia.forEach(p => console.log(`   ${p.municipio} — ${p.nombre}`))
  if (sinPadron.length) {
    console.log(`\n⚠️  Filas del Excel sin municipio en el padrón: ${sinPadron.length}`)
    sinPadron.forEach(f => console.log(`   [${f.sheet}] ${f.municipio} — ${f.nombre}`))
  }
  console.log(DRY ? '\n🧪 Simulación terminada (nada se escribió).' : '\n✅ Excel aplicado.')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
