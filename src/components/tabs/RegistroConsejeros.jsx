import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { distritoInfo, DISTRITOS_ORDEN } from '../../lib/distritos'
import RegistroConsejeroModal from '../modals/RegistroConsejeroModal'
import {
  IconSearch, IconFilter, IconCheck, IconX,
  IconChevronLeft, IconChevronRight, IconUsers,
} from '../Icons'

const PAGE_SIZE = 50

// Aplica los filtros activos (búsqueda, distrito) a cualquier query.
function aplicarFiltros(query, { search, distritoFiltro }) {
  if (search.trim()) {
    query = query.or(`nombre.ilike.%${search}%,municipio_origen.ilike.%${search}%`)
  }
  if (distritoFiltro) query = query.eq('distrito', distritoFiltro)
  return query
}

export default function RegistroConsejeros({ usuario }) {
  const [consejeros, setConsejeros]   = useState([])
  const [total, setTotal]             = useState(0)
  const [totalPresentes, setPresentes] = useState(0)
  const [page, setPage]               = useState(0)
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [distritoFiltro, setDistrito] = useState('')
  const [soloAusentes, setSoloAusentes] = useState(false)
  const [selected, setSelected]       = useState(null)
  const debounceRef                   = useRef(null)

  const fetchConsejeros = useCallback(async (currentPage = 0) => {
    setLoading(true)
    const from = currentPage * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let query = supabase
      .from('consejeros_desayuno')
      .select('*', { count: 'exact' })
      .order('numero')
      .range(from, to)

    query = aplicarFiltros(query, { search, distritoFiltro })
    if (soloAusentes) query = query.eq('asistio', false)

    // Conteos globales del alcance actual (independientes de la paginación)
    let totalQ = aplicarFiltros(
      supabase.from('consejeros_desayuno').select('id', { count: 'exact', head: true }),
      { search, distritoFiltro },
    )
    let presentesQ = aplicarFiltros(
      supabase.from('consejeros_desayuno').select('id', { count: 'exact', head: true }).eq('asistio', true),
      { search, distritoFiltro },
    )

    const [{ data, count }, { count: totalCount }, { count: presCount }] =
      await Promise.all([query, totalQ, presentesQ])

    setConsejeros(data || [])
    setTotal(soloAusentes ? (count || 0) : (totalCount || 0))
    setPresentes(presCount || 0)
    setLoading(false)
  }, [search, distritoFiltro, soloAusentes])

  useEffect(() => {
    setPage(0)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchConsejeros(0), 350)
    return () => clearTimeout(debounceRef.current)
  }, [search, distritoFiltro, soloAusentes])

  useEffect(() => { fetchConsejeros(page) }, [page])

  function handleActualizado(c, prevAsistio) {
    setConsejeros(prev => prev.map(x => x.id === c.id ? c : x))
    setSelected(c)
    if (c.asistio && !prevAsistio) setPresentes(p => p + 1)
    if (!c.asistio && prevAsistio) setPresentes(p => Math.max(0, p - 1))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const alcance    = total > 0 ? total : 0
  const pct        = alcance > 0 ? ((totalPresentes / alcance) * 100).toFixed(1) : '0.0'
  const hasFilters = search || distritoFiltro || soloAusentes

  return (
    <div className="space-y-4">
      {/* Barra de progreso */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#409b8420' }}>
              <IconUsers className="w-5 h-5" style={{ color: '#0e322e' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Asistencia de consejeros{distritoFiltro ? ` — ${distritoInfo(distritoFiltro).label}` : ''}
              </p>
              <p className="text-xs text-gray-400">
                <span className="font-bold text-green-600">{totalPresentes.toLocaleString('es-MX')}</span>
                {' '}presentes de{' '}
                <span className="font-bold text-gray-700">{alcance > 0 ? alcance.toLocaleString('es-MX') : '...'}</span>
                {' '}consejeros
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-2xl font-black" style={{ color: '#0e322e' }}>{pct}%</span>
          </div>
        </div>
        <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ background: 'linear-gradient(to right, #409b84, #0e322e)', width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <IconSearch className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por consejero o municipio de origen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#409b84] focus:border-transparent text-sm bg-gray-50 focus:bg-white transition"
            />
          </div>

          <div className="relative sm:w-60">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <IconFilter className="w-3.5 h-3.5" />
            </div>
            <select
              value={distritoFiltro}
              onChange={e => setDistrito(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#409b84] focus:border-transparent text-sm bg-gray-50 focus:bg-white transition appearance-none"
            >
              <option value="">Todos los distritos</option>
              {DISTRITOS_ORDEN.map(d => (
                <option key={d} value={d}>{distritoInfo(d).label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSoloAusentes(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all whitespace-nowrap ${
              soloAusentes
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <IconX className="w-3.5 h-3.5" />
            Solo ausentes
          </button>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400">
            {loading ? 'Cargando...' : (
              <>
                <span className="font-semibold text-gray-600">{total.toLocaleString('es-MX')}</span>
                {' '}consejeros{hasFilters ? ' con los filtros aplicados' : ''}
              </>
            )}
          </span>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setDistrito(''); setSoloAusentes(false) }}
              className="text-xs font-medium" style={{ color: '#26645b' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Consejero(a) / Municipio origen</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden md:table-cell">Distrito</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden lg:table-cell">RSVP</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: '#409b84', borderTopColor: 'transparent' }} />
                      <span className="text-xs text-gray-400">Cargando consejeros...</span>
                    </div>
                  </td>
                </tr>
              ) : consejeros.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <IconUsers className="w-10 h-10 opacity-30" />
                      <span className="font-medium">Sin resultados</span>
                      <span className="text-xs">Ajusta el distrito o los filtros de búsqueda</span>
                    </div>
                  </td>
                </tr>
              ) : (
                consejeros.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`cursor-pointer hover:bg-[#409b84]/10 transition-colors group ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar consejero={c} />
                        <div>
                          <p className="font-semibold text-gray-900 leading-tight">{c.nombre}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{c.municipio_origen || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <DistritoBadge distrito={c.distrito} />
                    </td>
                    <td className="px-5 py-3.5 text-center hidden lg:table-cell">
                      <RsvpBadge confirmacion={c.confirmacion} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {c.asistio ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          <IconCheck className="w-3 h-3" /> Presente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <IconX className="w-3 h-3" /> Ausente
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-5 py-3.5 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Página <span className="font-semibold text-gray-700">{page + 1}</span> de{' '}
              <span className="font-semibold text-gray-700">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
              >
                <IconChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
              >
                Siguiente <IconChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <RegistroConsejeroModal
          consejero={selected}
          usuario={usuario}
          onClose={() => setSelected(null)}
          onActualizado={handleActualizado}
        />
      )}
    </div>
  )
}

function Avatar({ consejero }) {
  const iniciales = (consejero.nombre || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
      consejero.asistio ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {iniciales}
    </div>
  )
}

function DistritoBadge({ distrito }) {
  const info = distritoInfo(distrito)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
      style={{ color: info.color, borderColor: `${info.color}40`, backgroundColor: `${info.color}12` }}
    >
      {info.label}
    </span>
  )
}

function RsvpBadge({ confirmacion }) {
  if (!confirmacion) return <span className="text-xs text-gray-300">Sin RSVP</span>
  const no = /NO/i.test(confirmacion)
  const conf = /CONFIRMAD/i.test(confirmacion)
  const cls = no
    ? 'bg-red-50 text-red-600 border-red-200'
    : conf
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cls}`}>
      {confirmacion}
    </span>
  )
}
