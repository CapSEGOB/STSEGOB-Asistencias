// Análisis (solo lectura) del cruce Excel de gira ↔ padrón por MUNICIPIO.
// No escribe nada. Reporta coincidencias, no-encontrados y duplicados.
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import * as XLSXmod from 'xlsx'
const XLSX = XLSXmod.default || XLSXmod

dotenv.config()
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const SHEET_DIA = { JUEVES: 1, VIERNES: 2, LUNES: 3, MARTES: 4 }

// Normaliza para emparejar: mayúsculas, sin acentos, sin dobles espacios.
function norm(str) {
  return (str || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}

function filasExcel() {
  const wb = XLSX.readFile('respaldos/presidentes.xlsx')
  const filas = []
  for (const sheet of wb.SheetNames) {
    const dia = SHEET_DIA[sheet.toUpperCase()]
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false, defval: '' })
    for (const r of rows.slice(2)) { // saltar título + encabezado
      const municipio = (r[1] || '').toString().trim()
      const nombre    = (r[2] || '').toString().trim()
      if (!municipio && !nombre) continue
      filas.push({
        dia, sheet, municipio, nombre,
        telefono:      (r[3] || '').toString().replace(/\s+/g, ' ').trim(),
        responsable:   (r[4] || '').toString().trim(),
        confirmacion:  (r[5] || '').toString().trim(),
        observaciones: (r[6] || '').toString().trim(),
      })
    }
  }
  return filas
}

async function main() {
  const filas = filasExcel()
  console.log(`📄 Filas de datos en Excel: ${filas.length}`)

  const { data: padron } = await s.from('presidentes_municipales').select('id,cve_ine,municipio,nombre')
  const idx = new Map(padron.map(p => [norm(p.municipio), p]))
  console.log(`🗂️  Padrón en BD: ${padron.length}`)

  const matched = [], noEncontrados = [], vistos = new Map()
  for (const f of filas) {
    const p = idx.get(norm(f.municipio))
    if (p) {
      matched.push({ f, p })
      vistos.set(norm(f.municipio), (vistos.get(norm(f.municipio)) || 0) + 1)
    } else {
      noEncontrados.push(f)
    }
  }

  console.log(`\n✅ Casan por municipio: ${matched.length}`)
  console.log(`❌ No encontrados en padrón: ${noEncontrados.length}`)
  noEncontrados.forEach(f => console.log(`   [${f.sheet}] "${f.municipio}" — ${f.nombre}`))

  const dups = [...vistos.entries()].filter(([, n]) => n > 1)
  console.log(`\n⚠️  Municipios repetidos en el Excel: ${dups.length}`)
  dups.forEach(([m, n]) => console.log(`   ${m} ×${n}`))

  const enExcel = new Set(matched.map(m => norm(m.f.municipio)))
  const sinDia = padron.filter(p => !enExcel.has(norm(p.municipio)))
  console.log(`\n🚫 Municipios del padrón que NO aparecen en el Excel (quedarían sin día): ${sinDia.length}`)
  sinDia.forEach(p => console.log(`   ${p.municipio} — ${p.nombre}`))

  // Diferencias de nombre notables (mismo municipio, nombre distinto)
  console.log('\n🔎 Nombres que difieren padrón vs Excel (muestra, máx 15):')
  let c = 0
  for (const { f, p } of matched) {
    if (norm(f.nombre) !== norm(p.nombre) && c < 15) {
      console.log(`   ${p.municipio}: padrón="${p.nombre}"  |  excel="${f.nombre}"`)
      c++
    }
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
