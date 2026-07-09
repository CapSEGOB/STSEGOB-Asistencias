// Clasifica los desajustes de nombre padrón vs Excel: cosmético vs persona distinta.
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import * as XLSXmod from 'xlsx'
const XLSX = XLSXmod.default || XLSXmod
dotenv.config()
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const SHEET_DIA = { JUEVES: 1, VIERNES: 2, LUNES: 3, MARTES: 4 }

const norm = t => (t || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = t => new Set(norm(t).split(' ').filter(x => x.length > 2))

function overlap(a, b) {
  const A = tokens(a), B = tokens(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / Math.min(A.size, B.size) // proporción de la lista más corta contenida en la otra
}

function filasExcel() {
  const wb = XLSX.readFile('respaldos/presidentes.xlsx')
  const filas = []
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false, defval: '' })
    for (const r of rows.slice(2)) {
      const municipio = (r[1] || '').toString().trim()
      const nombre = (r[2] || '').toString().trim()
      if (!municipio && !nombre) continue
      filas.push({ dia: SHEET_DIA[sheet.toUpperCase()], municipio, nombre })
    }
  }
  return filas
}

async function main() {
  const filas = filasExcel()
  const { data: padron } = await s.from('presidentes_municipales').select('municipio,nombre')
  const idx = new Map(padron.map(p => [norm(p.municipio), p]))

  const distintos = [], cosmeticos = []
  for (const f of filas) {
    const p = idx.get(norm(f.municipio))
    if (!p) continue
    if (norm(f.nombre) === norm(p.nombre)) continue
    const ov = overlap(f.nombre, p.nombre)
    if (ov >= 0.6) cosmeticos.push({ f, p, ov })
    else distintos.push({ f, p, ov })
  }
  console.log(`Cosméticos (mismo nombre, formato distinto): ${cosmeticos.length}`)
  console.log(`\n⚠️  PERSONA DISTINTA (padrón desactualizado o suplente): ${distintos.length}`)
  distintos.forEach(({ f, p }) => console.log(`   ${p.municipio}\n      padrón: ${p.nombre}\n      excel : ${f.nombre}`))
}
main().catch(e => { console.error('❌', e.message); process.exit(1) })
