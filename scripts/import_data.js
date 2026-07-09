import fs from 'fs'
import path from 'path'
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

async function backupCurrentData() {
  console.log('\n📦 Respaldando datos actuales...')
  
  const { data: asistentes } = await supabase
    .from('asistentes')
    .select('*')
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = `respaldos/backup_asistentes_${timestamp}.json`
  
  fs.writeFileSync(backupFile, JSON.stringify(asistentes, null, 2))
  console.log(`✅ Backup guardado: ${backupFile}`)
  
  return asistentes.length
}

async function processAndImportData() {
  console.log('\n📥 Procesando e importando datos...')
  
  const jsonFile = 'respaldos/asistentes_nuevos_BORRADOR.json'
  const rawData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'))
  
  // Procesar datos: dividir en salón 1 y 2
  const processed = rawData.map((item, idx) => {
    const obj = {
      nombres: item.nombres,
      apellido_paterno: item.apellido_paterno,
      apellido_materno: item.apellido_materno,
      cargo: item.cargo,
      puesto: item.puesto,
      dependencia: item.dependencia,
      salon: idx < Math.ceil(rawData.length / 2) ? 'Salón 1' : 'Salón 2',
      asistio: false,
      registrado_por: null,
    }
    // Solo incluir foto_url si existe en el item original
    if (item.foto_url) obj.foto_url = item.foto_url
    return obj
  })
  
  console.log(`📊 Total registros a importar: ${processed.length}`)
  
  // Registros sin titular
  const sinTitular = processed.filter(r => !r.nombres || !r.apellido_paterno)
  if (sinTitular.length > 0) {
    console.log(`⚠️  ${sinTitular.length} registros sin titular asignado (se importarán igual)`)
  }
  
  // Importar en lotes de 100
  const batchSize = 100
  for (let i = 0; i < processed.length; i += batchSize) {
    const batch = processed.slice(i, i + batchSize)
    const { error } = await supabase.from('asistentes').insert(batch)
    
    if (error) {
      console.error(`❌ Error en lote ${i}-${i + batchSize}: ${error.message}`)
      throw error
    }
    console.log(`✅ Importados ${Math.min(i + batchSize, processed.length)}/${processed.length}`)
  }
}

async function generatePlatformUsers() {
  console.log('\n👥 Generando 20 usuarios de plataforma...')
  
  const users = []
  const usedNumbers = new Set()
  
  // Generar 20 usuarios con números únicos
  while (users.length < 20) {
    const num = Math.floor(Math.random() * 50) + 1 // 1-50
    if (!usedNumbers.has(num)) {
      usedNumbers.add(num)
      const username = `SEGOB_${String(num).padStart(2, '0')}`
      const passwordNum = Math.floor(Math.random() * 100) // 0-99
      const password = `SEGOB_${String(passwordNum).padStart(2, '0')}`
      
      users.push({
        username,
        password,
        email: `${username.toLowerCase()}@stsegob.gob.mx`,
        nombre: username,
        rol: 'staff',
      })
    }
  }
  
  // Crear usuarios en Supabase Auth
  const createdUsers = []
  
  for (const user of users) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        user_metadata: { nombre: user.nombre, rol: user.rol },
        email_confirm: true,
      })
      
      if (error) {
        console.error(`⚠️  Error creando usuario ${user.username} en Auth: ${error.message}`)
        continue
      }
      
      // Insertrar en tabla usuarios
      const { error: insertError } = await supabase.from('usuarios').insert({
        id: data.user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      }).select()
      
      if (insertError) {
        console.error(`⚠️  Usuario ${user.username} creado en Auth pero no registrado en DB (posible duplicado)`)
        // Igualmente lo agregamos a la lista porque Auth fue exitoso
      } else {
        console.log(`✅ Usuario creado: ${user.username}`)
      }
      
      // Agregar a lista final independientemente de si se registró en DB
      createdUsers.push(user)
      
    } catch (err) {
      console.error(`❌ Error inesperado con ${user.username}: ${err.message}`)
    }
  }
  
  return createdUsers
}

async function main() {
  try {
    console.log('🚀 Iniciando proceso de importación...')
    
    // 1. Respaldar
    const backupCount = await backupCurrentData()
    console.log(`   Datos respaldados: ${backupCount} registros anteriores`)
    
    // 2. Importar asistentes
    await processAndImportData()
    
    // 3. Generar usuarios de plataforma
    const platformUsers = await generatePlatformUsers()
    
    // 4. Guardar lista de usuarios
    const timestamp = new Date().toISOString().split('T')[0]
    const usersListFile = `respaldos/usuarios_plataforma_${timestamp}.json`
    fs.writeFileSync(usersListFile, JSON.stringify(platformUsers, null, 2))
    
    console.log(`\n✅ Proceso completado exitosamente`)
    console.log(`📋 Lista de usuarios guardada: ${usersListFile}`)
    console.log(`\n🔐 Credenciales de usuarios (20 creados):`)
    platformUsers.forEach(u => {
      console.log(`   ${u.username} / ${u.password}`)
    })
    
  } catch (error) {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  }
}

main()
