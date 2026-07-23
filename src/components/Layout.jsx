import { useState } from 'react'
import { supabase } from '../lib/supabase'
import RegistroPresidentes from './tabs/RegistroPresidentes'
import RegistroConsejeros from './tabs/RegistroConsejeros'
import RegistroPC from './tabs/RegistroPC'
import EstadisticasPC from './tabs/EstadisticasPC'
import RegistroUsuarios from './tabs/RegistroUsuarios'
import Estadisticas from './tabs/Estadisticas'
import EstadisticasConsejeros from './tabs/EstadisticasConsejeros'
import { IconChart, IconLogout, IconUserPlus, IconPin, IconUsers } from './Icons'

// Cada evento es independiente: su propia lista y sus propias estadísticas.
const EVENTOS = [
  {
    id: 'presidentes',
    label: 'Gira Presidentes',
    short: 'Presidentes',
    tabs: [
      { id: 'pm-registro', label: 'Registro',     icon: IconPin,   render: u => <RegistroPresidentes usuario={u} /> },
      { id: 'pm-stats',    label: 'Estadísticas',  icon: IconChart, render: u => <Estadisticas usuario={u} /> },
    ],
  },
  {
    id: 'consejeros',
    label: 'Desayuno Consejeros',
    short: 'Consejeros',
    tabs: [
      { id: 'cd-registro', label: 'Registro',     icon: IconPin,   render: u => <RegistroConsejeros usuario={u} /> },
      { id: 'cd-stats',    label: 'Estadísticas',  icon: IconChart, render: u => <EstadisticasConsejeros usuario={u} /> },
    ],
  },
  {
    id: 'proteccion-civil',
    label: 'Consejo Protección Civil',
    short: 'Prot. Civil',
    tabs: [
      { id: 'pc-presencial', label: 'Presencial',   icon: IconPin,   render: u => <RegistroPC usuario={u} modalidad="presencial" /> },
      { id: 'pc-zoom',       label: 'Vía Zoom',     icon: IconUsers, render: u => <RegistroPC usuario={u} modalidad="zoom" /> },
      { id: 'pc-stats',      label: 'Estadísticas',  icon: IconChart, render: u => <EstadisticasPC usuario={u} /> },
    ],
  },
]

// Sección global (no ligada a un evento), solo admin.
const USUARIOS_TAB = { id: 'usuarios', label: 'Usuarios', icon: IconUserPlus, render: () => <RegistroUsuarios /> }

export default function Layout({ usuario }) {
  const isAdmin = usuario.rol === 'super_admin'
  const [eventoId, setEventoId] = useState(EVENTOS[0].id)
  const [tabId, setTabId]       = useState(EVENTOS[0].tabs[0].id)

  const evento = EVENTOS.find(e => e.id === eventoId) || EVENTOS[0]
  const tabs = [...evento.tabs, ...(isAdmin ? [USUARIOS_TAB] : [])]
  const activeTab = tabs.find(t => t.id === tabId) || tabs[0]

  function cambiarEvento(id) {
    const ev = EVENTOS.find(e => e.id === id)
    setEventoId(id)
    setTabId(ev.tabs[0].id) // al cambiar de evento, volver a su primera pestaña
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="text-white shadow-xl" style={{ backgroundColor: '#0e322e' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <img src="/logogob.png" alt="Logo" className="h-9 w-auto drop-shadow" />
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

        {/* Selector de evento */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 pr-1 flex-shrink-0">Evento</span>
            {EVENTOS.map(ev => {
              const active = ev.id === eventoId
              return (
                <button
                  key={ev.id}
                  onClick={() => cambiarEvento(ev.id)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex-shrink-0"
                  style={active
                    ? { backgroundColor: '#c79c67', color: '#0e322e', borderColor: '#c79c67' }
                    : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.15)' }
                  }
                >
                  {ev.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabs nav del evento activo */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab.id === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setTabId(tab.id)}
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
        {activeTab.render(usuario)}
      </main>
    </div>
  )
}
