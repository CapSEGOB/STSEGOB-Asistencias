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
      <header className="text-white shadow-xl" style={{ backgroundColor: '#0e322e' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <img
                src="/logogob.png"
                alt="Logo"
                className="h-9 w-auto drop-shadow"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white leading-none">STSEGOB</h1>
                  <span className="hidden sm:inline text-white/40 text-xs">—</span>
                  <span className="hidden sm:inline text-white/60 text-xs font-medium">Control de Asistencia</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-white/60 text-xs truncate max-w-[160px]">{usuario.nombre}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                    style={isAdmin
                      ? { backgroundColor: '#c79c6720', color: '#c79c67', borderColor: '#c79c6740' }
                      : { backgroundColor: '#409b8420', color: '#409b84', borderColor: '#409b8440' }
                    }
                  >
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all"
                  style={active
                    ? { borderColor: '#c79c67', color: '#fff' }
                    : { borderColor: 'transparent', color: 'rgba(255,255,255,0.55)' }
                  }
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
        {activeTab === 'estadisticas' && <Estadisticas usuario={usuario} />}
        {activeTab === 'usuarios'     && isAdmin && <RegistroUsuarios />}
      </main>
    </div>
  )
}
