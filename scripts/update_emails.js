import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function updateUserEmails() {
  console.log('\n🔄 Actualizando emails de usuarios...\n')
  
  // Leer usuarios actuales
  const usersData = JSON.parse(fs.readFileSync('respaldos/usuarios_plataforma_2026-07-04.json', 'utf-8'))
  
  const updatedUsers = []
  
  for (const user of usersData) {
    // Extraer número del username: SEGOB_06 → 06
    const num = user.username.split('_')[1]
    const newEmail = `${num}@segob.com`
    
    try {
      // Actualizar en Auth
      const { error } = await supabase.auth.admin.updateUserById(
        // Necesitamos obtener el user ID primero
        (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === user.email)?.id,
        { email: newEmail }
      )
      
      if (error) {
        console.log(`⚠️  ${user.username}: ${error.message}`)
      } else {
        console.log(`✅ ${user.username} → ${newEmail}`)
      }
      
      // Actualizar en tabla usuarios
      await supabase
        .from('usuarios')
        .update({ email: newEmail })
        .eq('nombre', user.nombre)
      
      updatedUsers.push({
        ...user,
        email: newEmail
      })
      
    } catch (err) {
      console.error(`❌ ${user.username}: ${err.message}`)
    }
  }
  
  // Guardar lista actualizada
  fs.writeFileSync('respaldos/usuarios_plataforma_2026-07-04.json', JSON.stringify(updatedUsers, null, 2))
  
  console.log(`\n✅ Emails actualizados: ${updatedUsers.length}/20`)
  console.log(`\n🔐 NUEVAS CREDENCIALES:`)
  console.log('─'.repeat(50))
  updatedUsers.forEach(u => {
    const num = u.username.split('_')[1]
    console.log(`Usuario: ${num}@segob.com${' '.repeat(20 - num.length - 10)} | Contraseña: ${u.password}`)
  })
  console.log('─'.repeat(50))
}

updateUserEmails().catch(console.error)
