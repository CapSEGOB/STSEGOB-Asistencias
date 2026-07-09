import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { partidoInfo, partidoLogoSrc, PARTIDOS_ORDEN } from '../../lib/partidos'
import RegistroPresidenteModal from '../modals/RegistroPresidenteModal'
import {
  IconSearch, IconFilter, IconCheck, IconX, IconCalendar,
  IconChevronLeft, IconChevronRight, IconUsers, IconUserGroup, IconPhone,
} from '../Icons'

const PAGE_SIZE = 50
const DIAS = [
  { val: '',    label: 'Todos' },
  { val: '1',   label: 'Día 1' },
  { val: '2',   label: 'Día 2' },
  { val: '3',   label: 'Día 3' },
  { val: '4',   label: 'Día 4' },
  { val: 'sin', label: 'Sin día' },
]

// Aplica los filtros activos a cualquier query (búsqueda, partido, día).
function aplicarFiltros(query, { search, partidoFiltro, diaFiltro }) {
  if (search.trim()) {
    query = query.or(`nombre.ilike.%${search}%,municipio.ilike.%${search}%`)
  }
  if (partidoFiltro) query = query.eq('partido', partidoFiltro)
  if (diaFiltro === 'sin') query = query.is('dia', null)
  else if (diaFiltro)      query = query.eq('dia', Number(diaFiltro))
  return query
}

export default function RegistroPresidentes({ usuario }) {
  const [presidentes, setPresidentes] = useState([])
  const [total, setTotal]             = useState(0)
  const [totalPresentes, setPresentes] = useState(0)
  const [page, setPage]               = useState(0)
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [partidoFiltro, setPartido]   = useState('')
  const [diaFiltro, setDia]           = useState('')
  const [soloAusentes, setSoloAusentes] = useState(false)
  const [selected, setSelected]       = useState(null)
  const debounceRef                   = useRef(null)

  const filtros = { search, partidoFiltro, diaFiltro }

  const fetchPresidentes = useCallback(async (currentPage = 0) => {
    setLoading(true)
    const from = currentPage * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let query = supabase
      .from('presidentes_municipales')
      .select('*', { count: 'exact' })
      .order('municipio')
      .range(from, to)

    query = aplicarFiltros(query, { search, partidoFiltro, diaFiltro })
    if (soloAusentes) query = query.eq('asistio', false)

    // Conteos globales del alcance actual (independientes de la paginación)
    let totalQ = aplicarFiltros(
      supabase.from('presidentes_municipales').select('id', { count: 'exact', head: true }),
      { search, partidoFiltro, diaFiltro },
    )
    let presentesQ = aplicarFiltros(
      supabase.from('presidentes_municipales').select('id', { count: 'exact', head: true }).eq('asistio', true),
      { search, partidoFiltro, diaFiltro },
    )

    const [{ data, count }, { count: totalCount }, { count: presCount }] =
      await Promise.all([query, totalQ, presentesQ])

    setPresidentes(data || [])
    setTotal(soloAusentes ? (count || 0) : (totalCount || 0))
    setPresentes(presCount || 0)
    setLoading(false)
  }, [search, partidoFiltro, diaFiltro, soloAusentes])

  useEffect(() => {
    setPage(0)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPresidentes(0), 350)
    return () => clearTimeout(debounceRef.current)
  }, [search, partidoFiltro, diaFiltro, soloAusentes])

  useEffect(() => { fetchPresidentes(page) }, [page])

  function handleActualizado(pres, prevAsistio) {
    setPresidentes(prev => prev.map(p => p.id === pres.id ? pres : p))
    setSelected(pres)
    // Ajustar el contador solo si cambió el estado de asistencia
    if (pres.asistio && !prevAsistio) setPresentes(p => p + 1)
    if (!pres.asistio && prevAsistio) setPresentes(p => Math.max(0, p - 1))
  }

  const totalPages   = Math.ceil(total / PAGE_SIZE)
  const alcance      = total > 0 ? total : 0
  const pct          = alcance > 0 ? ((totalPresentes / alcance) * 100).toFixed(1) : '0.0'
  const hasFilters   = search || partidoFiltro || soloAusentes

  return (
    <div className="space-y-4">
      {/* Selector de día */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 pl-1 pr-1 flex-shrink-0">
            <IconCalendar className="w-3.5 h-3.5" /> Día
          </span>
          {DIAS.map(d => {
            const active = diaFiltro === d.val
            return (
              <button
                key={d.val}
                onClick={() => setDia(d.val)}
                className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border"
                style={active
                  ? { backgroundColor: '#0e322e', color: '#fff', borderColor: '#0e322e' }
                  : { backgroundColor: '#fff', color: '#26645b', borderColor: '#e5e7eb' }
                }
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#409b8420' }}>
              <IconUsers className="w-5 h-5" style={{ color: '#0e322e' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Asistencia de presidentes{diaFiltro && diaFiltro !== 'sin' ? ` — Día ${diaFiltro}` : ''}
              </p>
              <p className="text-xs text-gray-400">
                <span className="font-bold text-green-600">{totalPresentes.toLocaleString('es-MX')}</span>
                {' '}presentes de{' '}
                <span className="font-bold text-gray-700">{alcance > 0 ? alcance.toLocaleString('es-MX') : '...'}</span>
                {' '}presidentes
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
              placeholder="Buscar por municipio o presidente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#409b84] focus:border-transparent text-sm bg-gray-50 focus:bg-white transition"
            />
          </div>

          <div className="relative sm:w-52">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <IconFilter className="w-3.5 h-3.5" />
            </div>
            <select
              value={partidoFiltro}
              onChange={e => setPartido(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#409b84] focus:border-transparent text-sm bg-gray-50 focus:bg-white transition appearance-none"
            >
              <option value="">Todos los partidos</option>
              {PARTIDOS_ORDEN.map(p => (
                <option key={p} value={p}>{partidoInfo(p).label}</option>
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
                {' '}presidentes{hasFilters || diaFiltro ? ' con los filtros aplicados' : ''}
              </>
            )}
          </span>
          {(hasFilters || diaFiltro) && (
            <button
              onClick={() => { setSearch(''); setPartido(''); setDia(''); setSoloAusentes(false) }}
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
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Presidente / Municipio</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden md:table-cell">Partido</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden lg:table-cell">Día</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: '#409b84', borderTopColor: 'transparent' }} />
                      <span className="text-xs text-gray-400">Cargando presidentes...</span>
                    </div>
                  </td>
                </tr>
              ) : presidentes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <IconUsers className="w-10 h-10 opacity-30" />
                      <span className="font-medium">Sin resultados</span>
                      <span className="text-xs">Ajusta el día o los filtros de búsqueda</span>
                    </div>
                  </td>
                </tr>
              ) : (
                presidentes.map((p, i) => {
                  const pInfo = partidoInfo(p.partido)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className={`cursor-pointer hover:bg-[#409b84]/10 transition-colors group ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar pres={p} />
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">{p.nombre}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{p.municipio}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <PartidoBadge partido={p.partido} />
                      </td>
                      <td className="px-5 py-3.5 text-center hidden lg:table-cell">
                        {p.dia ? (
                          <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">Día {p.dia}</span>
                        ) : (
                          <span className="text-xs text-gray-300">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {p.asistio ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                              <IconCheck className="w-3 h-3" /> Presente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              <IconX className="w-3 h-3" /> Ausente
                            </span>
                          )}
                          {p.asistio && p.acompanante && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#26645b]">
                              <IconUserGroup className="w-3 h-3" /> +1 acompañante
                            </span>
                          )}
                          {!p.asistio && p.confirmacion && /NO/i.test(p.confirmacion) && (
                            <span className="inline-flex items-center text-[10px] font-medium text-red-500">No asiste (RSVP)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
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
        <RegistroPresidenteModal
          presidente={selected}
          usuario={usuario}
          onClose={() => setSelected(null)}
          onActualizado={handleActualizado}
        />
      )}
    </div>
  )
}

function Avatar({ pres }) {
  const [err, setErr] = useState(false)
  const iniciales = (pres.nombre || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  if (pres.foto_url && !err) {
    return (
      <img
        src={pres.foto_url}
        alt={pres.nombre}
        onError={() => setErr(true)}
        className={`w-9 h-9 rounded-full object-cover flex-shrink-0 border-2 ${pres.asistio ? 'border-green-300' : 'border-gray-200'}`}
      />
    )
  }
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
      pres.asistio ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {iniciales}
    </div>
  )
}

function PartidoBadge({ partido }) {
  const info = partidoInfo(partido)
  const logo = partidoLogoSrc(partido)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
      style={{ color: info.color, borderColor: `${info.color}40`, backgroundColor: `${info.color}12` }}
    >
      {logo && <img src={logo} alt="" className="w-4 h-4 rounded-sm object-contain" />}
      {info.label}
    </span>
  )
}
