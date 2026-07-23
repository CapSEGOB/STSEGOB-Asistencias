import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { IconSearch, IconCheck, IconX, IconUsers } from './Icons'

// Página PÚBLICA (sin login) de auto-registro de asistencia vía Zoom
// para el Consejo Estatal de Protección Civil. Se accede con #/zoom.
// Solo usa las RPC pc_buscar_zoom / pc_registrar_zoom (rol anon).
export default function ZoomRegistro() {
  const [search, setSearch]       = useState('')
  const [resultados, setResultados] = useState(null) // null = aún no busca
  const [buscando, setBuscando]   = useState(false)
  const [sel, setSel]             = useState(null)   // registro elegido
  const [digitos, setDigitos]     = useState('')
  const [enviando, setEnviando]   = useState(false)
  const [error, setError]         = useState(null)
  const [exito, setExito]         = useState(null)   // { nombre, yaRegistrado }
  const debounceRef               = useRef(null)

  function onSearchChange(v) {
    setSearch(v)
    setSel(null)
    setError(null)
    clearTimeout(debounceRef.current)
    if (v.trim().length < 3) { setResultados(null); return }
    debounceRef.current = setTimeout(() => buscar(v), 400)
  }

  async function buscar(texto) {
    setBuscando(true)
    const { data, error } = await supabase.rpc('pc_buscar_zoom', { p_busqueda: texto.trim() })
    setResultados(error ? [] : (data || []))
    setBuscando(false)
  }

  async function confirmar() {
    if (!sel) return
    setEnviando(true)
    setError(null)
    const { data, error } = await supabase.rpc('pc_registrar_zoom', {
      p_id: sel.id,
      p_ultimos4: digitos,
    })
    setEnviando(false)

    if (error) { setError('Error de conexión. Intenta de nuevo.'); return }
    if (!data?.ok) {
      setError(data?.error === 'telefono_no_coincide'
        ? 'Los dígitos no coinciden con el teléfono registrado. Verifica e intenta de nuevo.'
        : 'No se encontró tu registro. Refresca la página e intenta de nuevo.')
      return
    }
    setExito({ nombre: data.nombre, yaRegistrado: !!data.ya_registrado })
  }

  // ---- Pantalla de éxito ----
  if (exito) {
    return (
      <Marco>
        <div className="text-center py-8 px-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-5">
            <IconCheck className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-gray-800 mb-1">
            {exito.yaRegistrado ? 'Ya estabas registrado(a)' : '¡Asistencia registrada!'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">{exito.nombre}</p>
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700">
            Tu asistencia al <span className="font-bold">Consejo Estatal de Protección Civil</span> quedó
            registrada correctamente. Puedes cerrar esta ventana y continuar en la sesión de Zoom.
          </div>
        </div>
      </Marco>
    )
  }

  return (
    <Marco>
      <div className="p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-black text-gray-800 leading-tight">Registro de asistencia vía Zoom</h2>
          <p className="text-xs text-gray-400 mt-1">Busca tu municipio o tu nombre y confirma tu asistencia.</p>
        </div>

        {/* Buscador */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <IconSearch className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Ej. Xicotepec o Juan Pérez..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            autoFocus
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#409b84] focus:border-transparent text-sm bg-gray-50 focus:bg-white transition"
          />
        </div>

        {/* Resultados */}
        {buscando && (
          <p className="text-center text-xs text-gray-400 py-2">Buscando...</p>
        )}
        {!buscando && resultados !== null && resultados.length === 0 && (
          <div className="text-center py-4 text-gray-400">
            <IconUsers className="w-8 h-8 mx-auto opacity-30 mb-1" />
            <p className="text-xs">No encontramos tu registro en la lista de Zoom.<br />Verifica el nombre o contacta a tu responsable.</p>
          </div>
        )}
        {!buscando && resultados && resultados.length > 0 && (
          <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
            {resultados.map(r => (
              <button
                key={r.id}
                onClick={() => { setSel(r); setDigitos(''); setError(null) }}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                  sel?.id === r.id ? 'bg-[#409b84]/10' : 'hover:bg-gray-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.nombre}</p>
                  <p className="text-xs text-gray-400">{r.municipio || '—'}</p>
                </div>
                {r.asistio ? (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                    <IconCheck className="w-3 h-3" /> Registrado
                  </span>
                ) : sel?.id === r.id && (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#26645b] flex items-center justify-center">
                    <IconCheck className="w-3 h-3 text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Confirmación */}
        {sel && !sel.asistio && (
          <div className="bg-slate-50 border border-gray-100 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-600">
              Confirmarás la asistencia de <span className="font-bold">{sel.nombre}</span> ({sel.municipio}).
            </p>
            {sel.tiene_tel && (
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Escribe los últimos 4 dígitos de tu teléfono ({sel.tel_hint})
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={digitos}
                  onChange={e => setDigitos(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="w-32 border border-gray-200 rounded-xl px-4 py-2.5 text-center text-lg font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#409b84] bg-white"
                />
              </label>
            )}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-xs">
                <IconX className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            <button
              onClick={confirmar}
              disabled={enviando || (sel.tiene_tel && digitos.length !== 4)}
              className="w-full py-3.5 rounded-xl text-white text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#26645b' }}
            >
              {enviando ? 'Registrando...' : <><IconCheck className="w-4 h-4" /> Confirmar mi asistencia</>}
            </button>
          </div>
        )}
        {sel?.asistio && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700 text-center">
            <span className="font-bold">{sel.nombre}</span> ya tiene su asistencia registrada. ✅
          </div>
        )}
      </div>
    </Marco>
  )
}

function Marco({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="text-white shadow-xl" style={{ backgroundColor: '#0e322e' }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/logogob.png" alt="Logo" className="h-9 w-auto drop-shadow" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Consejo Estatal de Protección Civil</h1>
            <p className="text-white/60 text-[11px]">STSEGOB — Registro de asistencia</p>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-lg overflow-hidden">
          {children}
        </div>
      </main>
      <footer className="text-center text-[11px] text-gray-400 pb-6">
        Secretaría de Gobernación del Estado de Puebla
      </footer>
    </div>
  )
}
