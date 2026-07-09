// ============================================================
// Carga del padrón de 217 presidentes municipales.
//  - Lee respaldos/peg_municipios.json (municipio, presidente, fil, foto)
//  - Descarga cada foto y la sube a Supabase Storage (bucket 'presidentes')
//  - Upsert en presidentes_municipales (idempotente por cve_ine)
//
// Requisito previo: correr scripts/sql/001_presidentes_municipales.sql
// Uso:
//   node scripts/import_presidentes.js            (padrón + fotos)
//   node scripts/import_presidentes.js --no-fotos (solo datos, sin subir fotos)
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

const SUBIR_FOTOS = !process.argv.includes('--no-fotos')
const BUCKET = 'presidentes'
const PADRON = 'respaldos/peg_municipios.json'

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function subirFoto(cveIne, urlOrigen) {
  if (!urlOrigen) return null
  try {
    const res = await fetch(urlOrigen)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const path = `${cveIne}.jpg`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    console.warn(`   ⚠️  foto ${cveIne}: ${err.message} — se usa URL original`)
    return urlOrigen // fallback: la URL de S3
  }
}

async function main() {
  console.log('🚀 Importando padrón de presidentes municipales...')
  const padron = JSON.parse(fs.readFileSync(PADRON, 'utf-8'))
  console.log(`📊 ${padron.length} municipios en el padrón`)

  const registros = []
  let n = 0
  for (const p of padron) {
    n++
    let fotoUrl = p.foto_presidente || null
    if (SUBIR_FOTOS) {
      fotoUrl = await subirFoto(p.cve_ine, p.foto_presidente)
      if (n % 25 === 0) console.log(`   fotos: ${n}/${padron.length}`)
    }
    registros.push({
      cve_ine:     p.cve_ine,
      municipio:   p.municipio,
      nombre:      p.presidente,
      partido:     p.fil || null,
      foto_url:    fotoUrl,
      asistio:     false,
      acompanante: false,
      dia:         null,
    })
  }

  console.log('\n💾 Upsert en presidentes_municipales (por cve_ine)...')
  const batchSize = 100
  for (let i = 0; i < registros.length; i += batchSize) {
    const batch = registros.slice(i, i + batchSize)
    const { error } = await supabase
      .from('presidentes_municipales')
      .upsert(batch, { onConflict: 'cve_ine', ignoreDuplicates: false })
    if (error) {
      console.error(`❌ Error lote ${i}: ${error.message}`)
      process.exit(1)
    }
    console.log(`   ✅ ${Math.min(i + batchSize, registros.length)}/${registros.length}`)
  }

  console.log('\n✅ Padrón cargado. Falta asignar día/teléfono desde el Excel de la gira.')
}

main().catch(e => { console.error('❌ Error fatal:', e); process.exit(1) })
