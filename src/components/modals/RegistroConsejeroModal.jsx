import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { distritoInfo } from '../../lib/distritos'
import { IconCheck, IconX, IconPin, IconPhone, IconUsers } from '../Icons'

export default function RegistroConsejeroModal({ consejero, usuario, onClose, onActualizado }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const [asistio, setAsistio] = useState(!!consejero.asistio)
  const [obs, setObs]         = useState(consejero.observaciones || '')

  const info = distritoInfo(consejero.distrito)

  const dirty =
       asistio !== !!consejero.asistio
    || obs !== (consejero.observaciones || '')

  async function guardar() {
    setLoading(true)
    setError(null)
    const prevAsistio = consejero.asistio

    const update = {
      asistio,
      observaciones: obs || null,
    }

    // Sello de registro: se pone al pasar a presente, se limpia al dejar de estarlo.
    if (asistio && !prevAsistio) {
      update.fecha_asistencia = new Date().toISOString()
      update.registrado_por   = usuario.id
    } else if (!asistio) {
      update.fecha_asistencia = null
      update.registrado_por   = null
    }

    const { data, error } = await supabase
      .from('consejeros_desayuno')
      .update(update)
      .eq('id', consejero.id)
      .select()
      .single()

    if (error) setError('Error al guardar. Intenta de nuevo.')
    else onActualizado(data, prevAsistio)
    setLoading(false)
  }

  const iniciales = (consejero.nombre || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  const rsvpNo = consejero.confirmacion && /NO/i.test(consejero.confirmacion)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-6 py-5 flex items-start gap-4 ${
          consejero.asistio ? 'bg-gradient-to-br from-green-600 to-emerald-700' : 'bg-gradient-to-br from-[#0e322e] to-[#26645b]'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white text-xl font-black border border-white/30">
            {iniciales}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${consejero.asistio ? 'text-green-200' : 'text-[#409b84]'}`}>
              Consejero(a) de MORENA
            </p>
            <h2 className="text-white font-bold text-base leading-tight">{consejero.nombre}</h2>
            <p className="text-white/70 text-xs mt-1">{consejero.municipio_origen || '—'}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Estado */}
        {consejero.asistio && (
          <div className="mx-5 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <IconCheck className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-700">Asistencia registrada</p>
              {consejero.fecha_asistencia && (
                <p className="text-xs text-green-600">
                  {new Date(consejero.fecha_asistencia).toLocaleString('es-MX', {
                    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Datos */}
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
              style={{ color: info.color, borderColor: `${info.color}40`, backgroundColor: `${info.color}12` }}>
              {info.label}
            </span>
            {consejero.telefono && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <IconPhone className="w-3.5 h-3.5 text-gray-400" />
                {consejero.telefono}
              </span>
            )}
            {consejero.confirmacion && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                rsvpNo
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : /CONFIRMAD/i.test(consejero.confirmacion)
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                RSVP: {consejero.confirmacion}
              </span>
            )}
          </div>

          {typeof consejero.numero === 'number' && (
            <p className="text-xs text-gray-400">
              <span className="font-semibold">N.º de lista:</span> {consejero.numero}
            </p>
          )}

          {/* Asistencia */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-500 block">¿Asistió al desayuno?</span>
            <button
              type="button"
              onClick={() => setAsistio(v => !v)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                asistio ? 'bg-[#409b84]/10 border-[#409b84]' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                asistio ? 'bg-[#26645b] border-[#26645b]' : 'border-gray-300 bg-white'
              }`}>
                {asistio && <IconCheck className="w-3 h-3 text-white" />}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <IconUsers className="w-4 h-4 text-gray-400" />
                Asistió al desayuno
              </span>
            </button>
            {!asistio && (
              <p className="text-[11px] text-gray-400 pl-1">
                Sin marcar: el consejero queda como <span className="font-semibold">ausente</span>.
              </p>
            )}
          </div>

          {/* Observaciones */}
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 mb-1.5 block">Observaciones</span>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={2}
              placeholder="Opcional..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#409b84] transition resize-none"
            />
          </label>
        </div>

        {error && (
          <div className="mx-5 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs">{error}</div>
        )}

        {/* Acciones */}
        <div className="px-5 pb-5">
          <button
            onClick={guardar}
            disabled={loading || !dirty}
            className="w-full py-4 rounded-xl text-white text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#26645b' }}
          >
            {loading ? <Spinner /> : <><IconPin className="w-4 h-4" /> {consejero.asistio ? 'Guardar cambios' : 'Registrar asistencia'}</>}
          </button>
          {!dirty && consejero.asistio && (
            <p className="text-center text-xs text-gray-400 mt-2">Ya registrado. Modifica algún dato para guardar.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
