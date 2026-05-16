import { useState } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { IconMail, IconLock, IconUsers, IconShield, IconUserPlus } from '../Icons'

export default function RegistroUsuarios() {
  const [form, setForm]       = useState({ nombre: '', email: '', password: '', rol: 'staff' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError]     = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!supabaseAdmin) {
      setError('Variable VITE_SUPABASE_SERVICE_ROLE_KEY no está configurada en el archivo .env')
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email:         form.email,
      password:      form.password,
      email_confirm: true,
      user_metadata: { nombre: form.nombre, rol: form.rol },
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage(`Usuario "${form.nombre}" (${form.email}) creado exitosamente como ${form.rol === 'super_admin' ? 'Administrador' : 'Staff'}.`)
      setForm({ nombre: '', email: '', password: '', rol: 'staff' })
    }
    setLoading(false)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-950 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <IconUserPlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Registrar nuevo usuario</h2>
            <p className="text-blue-300 text-xs mt-0.5">Personal con acceso al sistema</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Nombre completo
            </label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition"
              placeholder="Ej. Juan Pérez García"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Correo electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <IconMail className="w-4 h-4" />
              </div>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition"
                placeholder="usuario@stsegob.gob.mx"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <IconLock className="w-4 h-4" />
              </div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          {/* Rol — selector visual */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Rol del usuario
            </label>
            <div className="grid grid-cols-2 gap-3">
              <RolCard
                value="staff"
                selected={form.rol === 'staff'}
                onClick={() => setForm(f => ({ ...f, rol: 'staff' }))}
                icon={<IconUsers className="w-5 h-5" />}
                title="Staff"
                desc="Registro de asistencia"
                color="blue"
              />
              <RolCard
                value="super_admin"
                selected={form.rol === 'super_admin'}
                onClick={() => setForm(f => ({ ...f, rol: 'super_admin' }))}
                icon={<IconShield className="w-5 h-5" />}
                title="Administrador"
                desc="Acceso total al sistema"
                color="amber"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">✓</span>
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-800 hover:bg-blue-900 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl transition-all shadow-sm hover:shadow-md text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creando usuario...
              </>
            ) : (
              <>
                <IconUserPlus className="w-4 h-4" />
                Crear usuario
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function RolCard({ selected, onClick, icon, title, desc, color }) {
  const colors = {
    blue:  { border: 'border-blue-500 bg-blue-50',  icon: 'bg-blue-100 text-blue-700', text: 'text-blue-800' },
    amber: { border: 'border-amber-500 bg-amber-50', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-800' },
  }
  const c = colors[color]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left ${
        selected
          ? `${c.border} shadow-sm`
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selected ? c.icon : 'bg-gray-100 text-gray-400'}`}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-bold ${selected ? c.text : 'text-gray-700'}`}>{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </button>
  )
}
