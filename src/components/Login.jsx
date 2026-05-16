import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconMail, IconLock, IconShield } from './Icons'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* Panel izquierdo — branding con imagen */}
      <div
        className="relative lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-16 overflow-hidden"
        style={{
          backgroundImage: 'url(/bg-login.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay oscuro para legibilidad */}
        <div className="absolute inset-0 bg-[#0e322e]/80" />

        {/* Contenido */}
        <div className="relative z-10 text-center flex flex-col items-center">
          <img
            src="/logogob.png"
            alt="Logo SEGOB"
            className="h-24 lg:h-32 w-auto mb-6 drop-shadow-2xl"
          />
          <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-2">
            STSEGOB
          </h1>
          <p className="text-white/80 text-base lg:text-lg font-medium mb-2">
            Secretaría de Seguridad del Gobierno
          </p>
          <div className="w-16 h-0.5 mx-auto my-4 rounded-full" style={{ backgroundColor: '#c79c67' }} />
          <p className="text-white/60 text-sm max-w-xs leading-relaxed">
            Sistema Oficial de Control de Asistencia para eventos institucionales.
          </p>
          <div className="mt-8 flex items-center gap-2 text-white/50 text-xs">
            <IconShield className="w-3.5 h-3.5" style={{ color: '#c79c67' }} />
            <span>Acceso restringido a personal autorizado</span>
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white lg:bg-slate-50">
        <div className="w-full max-w-md">

          {/* Logo solo móvil (cuando el panel izq queda arriba) */}
          <div className="lg:hidden text-center mb-8">
            <img src="/logogob.png" alt="Logo SEGOB" className="h-16 w-auto mx-auto mb-3" />
            <h1 className="text-xl font-black" style={{ color: '#0e322e' }}>STSEGOB</h1>
            <p className="text-gray-500 text-sm">Control de Asistencia</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
              <p className="text-gray-500 text-sm mt-1">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <IconMail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition text-sm bg-gray-50 focus:bg-white"
                    style={{ '--tw-ring-color': '#409b84' }}
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px #409b8460'}
                    onBlur={e => e.target.style.boxShadow = ''}
                    placeholder="usuario@stsegob.gob.mx"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <IconLock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none transition text-sm bg-gray-50 focus:bg-white"
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px #409b8460'}
                    onBlur={e => e.target.style.boxShadow = ''}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold py-3.5 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.99] text-sm mt-2 disabled:opacity-60"
                style={{ backgroundColor: '#0e322e' }}
                onMouseEnter={e => !loading && (e.target.style.backgroundColor = '#26645b')}
                onMouseLeave={e => e.target.style.backgroundColor = '#0e322e'}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Iniciando sesión...
                  </span>
                ) : 'Iniciar sesión'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Sistema de uso exclusivo para personal autorizado
          </p>
        </div>
      </div>
    </div>
  )
}
