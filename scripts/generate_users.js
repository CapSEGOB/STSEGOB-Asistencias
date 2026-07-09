import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function generateNewUsers() {
  console.log('\n👥 Generando 20 nuevos usuarios de plataforma...')
  
  // Obtener usuarios existentes
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingEmails = new Set(existingUsers.users.map(u => u.email))
  
  const users = []
  const usedNumbers = new Set()
  
  // Generar 20 usuarios con números únicos
  let attempts = 0
  while (users.length < 20 && attempts < 100) {
    attempts++
    const num = Math.floor(Math.random() * 50) + 1 // 1-50
    if (!usedNumbers.has(num)) {
      usedNumbers.add(num)
      const username = `SEGOB_${String(num).padStart(2, '0')}`
      const passwordNum = Math.floor(Math.random() * 100) // 0-99
      const password = `SEGOB_${String(passwordNum).padStart(2, '0')}`
      const email = `${username.toLowerCase()}@stsegob.gob.mx`
      
      // Verificar si el usuario ya existe
      if (!existingEmails.has(email)) {
        users.push({ username, password, email, nombre: username, rol: 'staff' })
      }
    }
  }
  
  console.log(`📊 Usuarios a crear: ${users.length}`)
  
  const createdUsers = []
  
  for (const user of users) {
    try {
      // Crear en Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        user_metadata: { nombre: user.nombre, rol: user.rol },
        email_confirm: true,
      })
      
      if (error) {
        console.log(`⚠️  ${user.username}: ${error.message}`)
        continue
      }
      
      // Crear en tabla usuarios
      await supabase.from('usuarios').upsert({
        id: data.user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      })
      
      console.log(`✅ ${user.username}`)
      createdUsers.push(user)
      
    } catch (err) {
      console.error(`❌ ${user.username}: ${err.message}`)
    }
  }
  
  // Guardar lista
  const timestamp = new Date().toISOString().split('T')[0]
  const file = `respaldos/usuarios_plataforma_${timestamp}.json`
  fs.writeFileSync(file, JSON.stringify(createdUsers, null, 2))
  
  console.log(`\n✅ Usuarios creados: ${createdUsers.length}`)
  console.log(`📋 Lista guardada: ${file}`)
  console.log(`\n🔐 CREDENCIALES DE ACCESO (Copiar y distribuir):`)
  console.log('─'.repeat(50))
  createdUsers.forEach(u => {
    console.log(`Usuario: ${u.username.padEnd(15)} | Contraseña: ${u.password}`)
  })
  console.log('─'.repeat(50))
}

generateNewUsers().catch(console.error)
