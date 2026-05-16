import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { IconCheck, IconX, IconPin, IconBuilding } from '../Icons'

export default function AsistenteModal({ asistente, usuario, onClose, onActualizado }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function marcarAsistencia() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('asistentes')
      .update({
        asistio: true,
        fecha_asistencia: new Date().toISOString(),
        registrado_por: usuario.id,
      })
      .eq('id', asistente.id)
      .select()
      .single()

    if (error) setError('Error al registrar asistencia. Intenta de nuevo.')
    else onActualizado(data)
    setLoading(false)
  }

  const initiales = [asistente.nombres?.[0], asistente.apellido_paterno?.[0]]
    .filter(Boolean).join('').toUpperCase()

  const nombreCompleto = [asistente.nombres, asistente.apellido_paterno, asistente.apellido_materno]
    .filter(Boolean).join(' ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con avatar */}
        <div className={`px-6 py-5 flex items-start gap-4 ${
          asistente.asistio ? 'bg-gradient-to-br from-green-600 to-emerald-700' : 'bg-gradient-to-br from-blue-900 to-blue-800'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white text-xl font-black border border-white/30">
            {initiales}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${
              asistente.asistio ? 'text-green-200' : 'text-blue-300'
            }`}>Asistente registrado</p>
            <h2 className="text-white font-bold text-base leading-tight">{nombreCompleto}</h2>
            <p className="text-white/70 text-xs mt-1">{asistente.cargo || asistente.puesto || 'Sin cargo'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Estado de asistencia */}
        {asistente.asistio && (
          <div className="mx-5 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <IconCheck className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-700">Asistencia confirmada</p>
              {asistente.fecha_asistencia && (
                <p className="text-xs text-green-600">
                  {new Date(asistente.fecha_asistencia).toLocaleString('es-MX', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Detalles */}
        <div className="p-5 space-y-1">
          <InfoSection title="Información institucional" icon={<IconBuilding className="w-4 h-4" />}>
            <InfoRow label="Dependencia" value={asistente.dependencia} />
            <InfoRow label="Puesto" value={asistente.puesto} />
            <InfoRow label="Cargo" value={asistente.cargo} />
          </InfoSection>

          <InfoSection title="Asignación de evento" icon={<IconPin className="w-4 h-4" />}>
            <InfoRow label="Salón" value={asistente.salon} />
          </InfoSection>
        </div>

        {error && (
          <div className="mx-5 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs">
            {error}
          </div>
        )}

        {/* Acción */}
        <div className="px-5 pb-5">
          {asistente.asistio ? (
            <div className="w-full py-3.5 rounded-xl bg-green-500 text-white text-sm font-bold text-center flex items-center justify-center gap-2">
              <IconCheck className="w-4 h-4" />
              Ya registrado en el evento
            </div>
          ) : (
            <button
              onClick={marcarAsistencia}
              disabled={loading}
              className="w-full py-4 rounded-xl text-white text-sm font-bold bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:bg-blue-400 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Registrando asistencia...
                </>
              ) : (
                <>
                  <IconPin className="w-4 h-4" />
                  Confirmar asistencia al evento
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoSection({ title, icon, children }) {
  const hasContent = Array.isArray(children)
    ? children.some(c => c && c.props?.value)
    : children?.props?.value
  if (!hasContent) return null
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-gray-400">{icon}</span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-3 items-start">
      <span className="text-xs font-medium text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-gray-800 font-medium">{value}</span>
    </div>
  )
}
