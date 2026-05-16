import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Layout from './components/Layout'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#409b84' }} />
    </div>
  )
}

export default function App() {
  // undefined = cargando, null = sin sesión, objeto = sesión activa
  const [session, setSession] = useState(undefined)
  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      // Limpiar tokens del hash de la URL tras autenticación
      if (session && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      supabase
        .from('usuarios')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => setUsuario(data))
    } else {
      setUsuario(null)
    }
  }, [session])

  if (session === undefined || (session && !usuario)) return <Spinner />
  if (!session) return <Login />

  return <Layout usuario={usuario} />
}
