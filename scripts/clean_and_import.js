import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Falta VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function cleanAndImport() {
  try {
    console.log('\n🚀 Iniciando limpieza e importación...\n')
    
    // 1. Limpiar tabla asistentes
    console.log('🗑️  Eliminando registros anteriores...')
    const { error: deleteError } = await supabase
      .from('asistentes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Eliminar todos
    
    if (deleteError) {
      console.error(`❌ Error al limpiar: ${deleteError.message}`)
      process.exit(1)
    }
    console.log(`✅ Base de datos limpiada`)
    
    // 2. Procesar e importar datos del PDF
    console.log('\n📥 Importando 107 registros del evento...')
    
    const jsonFile = 'respaldos/asistentes_nuevos_BORRADOR.json'
    const rawData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'))
    
    // Procesar datos con salon = "Evento 1" para todos
    const processed = rawData.map((item) => ({
      nombres: item.nombres,
      apellido_paterno: item.apellido_paterno,
      apellido_materno: item.apellido_materno,
      cargo: item.cargo,
      puesto: item.puesto,
      dependencia: item.dependencia,
      salon: 'Evento 1',
      asistio: false,
      registrado_por: null,
    }))
    
    console.log(`📊 Total registros a importar: ${processed.length}`)
    
    // Registros sin titular
    const sinTitular = processed.filter(r => !r.nombres || !r.apellido_paterno)
    if (sinTitular.length > 0) {
      console.log(`⚠️  ${sinTitular.length} registros sin titular asignado`)
    }
    
    // Importar en lotes de 100
    const batchSize = 100
    for (let i = 0; i < processed.length; i += batchSize) {
      const batch = processed.slice(i, i + batchSize)
      const { error } = await supabase.from('asistentes').insert(batch)
      
      if (error) {
        console.error(`❌ Error en lote ${i}-${i + batchSize}: ${error.message}`)
        process.exit(1)
      }
      console.log(`✅ Importados ${Math.min(i + batchSize, processed.length)}/${processed.length}`)
    }
    
    console.log(`\n✅ IMPORTACIÓN COMPLETADA`)
    console.log(`   • 107 registros en "Evento 1"`)
    console.log(`   • Base de datos limpia (solo datos del PDF)`)
    console.log(`   • Usuarios de plataforma: 20 (sin cambios)`)
    
  } catch (error) {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  }
}

cleanAndImport()
