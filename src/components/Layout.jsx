import { useState } from 'react'
import { supabase } from '../lib/supabase'
import RegistroAsistencia from './tabs/RegistroAsistencia'
import RegistroUsuarios from './tabs/RegistroUsuarios'
import Estadisticas from './tabs/Estadisticas'
import { IconClipboard, IconUsers, IconChart, IconLogout, IconUserPlus } from './Icons'

const TABS = [
  { id: 'asistencia',   label: 'Registro de Asistencia', icon: IconClipboard, roles: ['super_admin', 'staff'] },
  { id: 'estadisticas', label: 'Estadísticas',           icon: IconChart,     roles: ['super_admin', 'staff'] },
  { id: 'usuarios',     label: 'Usuarios',               icon: IconUserPlus,  roles: ['super_admin'] },
]

export default function Layout({ usuario }) {
  const tabs = TABS.filter(t => t.roles.includes(usuario.rol))
  const [activeTab, setActiveTab] = useState(tabs[0].id)

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const isAdmin = usuario.rol === 'super_admin'

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-blue-950 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 flex-shrink-0">
                <span className="text-white text-sm font-black">ST</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white leading-none">STSEGOB</h1>
                  <span className="hidden sm:inline text-blue-400 text-xs">—</span>
                  <span className="hidden sm:inline text-blue-300 text-xs font-medium">Control de Asistencia</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-blue-300 text-xs truncate max-w-[160px]">{usuario.nombre}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isAdmin
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                  }`}>
                    {isAdmin ? 'Admin' : 'Staff'}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <IconLogout className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>

        {/* Tabs nav */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                    active
                      ? 'border-amber-400 text-white'
                      : 'border-transparent text-blue-300 hover:text-white hover:border-blue-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'asistencia'   && <RegistroAsistencia usuario={usuario} />}
        {activeTab === 'estadisticas' && <Estadisticas />}
        {activeTab === 'usuarios'     && isAdmin && <RegistroUsuarios />}
      </main>
    </div>
  )
}
