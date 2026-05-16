import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import AsistenteModal from '../modals/AsistenteModal'
import {
  IconSearch, IconFilter, IconCheck, IconX,
  IconChevronLeft, IconChevronRight, IconUsers,
} from '../Icons'

const PAGE_SIZE = 50

export default function RegistroAsistencia({ usuario }) {
  const [asistentes, setAsistentes]     = useState([])
  const [total, setTotal]               = useState(0)
  const [totalPresentes, setTotalPresentes] = useState(0)
  const [page, setPage]                 = useState(0)
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState('')
  const [dependenciaFiltro, setDep]     = useState('')
  const [salonFiltro, setSalon]         = useState('')
  const [soloAusentes, setSoloAusentes] = useState(false)
  const [dependencias, setDependencias] = useState([])
  const [salones, setSalones]           = useState([])
  const [selectedAsistente, setSelected] = useState(null)
  const debounceRef                      = useRef(null)

  useEffect(() => {
    // Usar count+head para obtener conteo sin datos y range para los filtros
    supabase.from('asistentes').select('dependencia', { count: 'exact' }).order('dependencia').range(0, 1999).then(({ data }) => {
      if (data) setDependencias([...new Set(data.map(d => d.dependencia))].filter(Boolean))
    })
    supabase.from('asistentes').select('salon', { count: 'exact' }).order('salon').range(0, 1999).then(({ data }) => {
      if (data) setSalones([...new Set(data.map(d => d.salon))].filter(Boolean))
    })
    // Contador global de presentes — count:exact no tiene límite de filas
    supabase.from('asistentes').select('id', { count: 'exact', head: true }).eq('asistio', true)
      .then(({ count }) => setTotalPresentes(count || 0))
  }, [])

  const fetchAsistentes = useCallback(async (currentPage = page) => {
    setLoading(true)
    const from = currentPage * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let query = supabase
      .from('asistentes')
      .select('*', { count: 'exact' })
      .order('apellido_paterno')
      .order('nombres')
      .range(from, to)

    if (search.trim()) {
      query = query.or(
        `nombres.ilike.%${search}%,apellido_paterno.ilike.%${search}%,apellido_materno.ilike.%${search}%`
      )
    }
    if (dependenciaFiltro) query = query.eq('dependencia', dependenciaFiltro)
    if (salonFiltro)       query = query.eq('salon', salonFiltro)
    if (soloAusentes)      query = query.eq('asistio', false)

    const { data, count } = await query
    setAsistentes(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [search, dependenciaFiltro, salonFiltro, soloAusentes, page])

  useEffect(() => {
    setPage(0)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchAsistentes(0), 350)
    return () => clearTimeout(debounceRef.current)
  }, [search, dependenciaFiltro, salonFiltro, soloAusentes])

  useEffect(() => { fetchAsistentes(page) }, [page])

  function handleActualizado(asistente) {
    setAsistentes(prev => prev.map(a => a.id === asistente.id ? asistente : a))
    setSelected(asistente)
    setTotalPresentes(p => p + 1)
  }

  const totalPages   = Math.ceil(total / PAGE_SIZE)
  const hasFilters   = search || dependenciaFiltro || salonFiltro || soloAusentes
  const pctPresentes = total > 0 ? ((totalPresentes / total) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-4">
      {/* Barra de progreso de asistencia */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#409b8420' }}>
              <IconUsers className="w-5 h-5" style={{ color: '#0e322e' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Asistencia en tiempo real</p>
              <p className="text-xs text-gray-400">
                <span className="font-bold text-green-600">{totalPresentes.toLocaleString('es-MX')}</span>
                {' '}presentes de{' '}
                <span className="font-bold text-gray-700">{total > 0 ? total.toLocaleString('es-MX') : '...'}</span>
                {' '}invitados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-2xl font-black" style={{ color: '#0e322e' }}>{pctPresentes}%</span>
          </div>
        </div>
        <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ background: 'linear-gradient(to right, #409b84, #0e322e)', width: `${pctPresentes}%` }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <IconSearch className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre o apellido..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#409b84] focus:border-transparent text-sm bg-gray-50 focus:bg-white transition"
            />
          </div>

          {/* Filtro dependencia */}
          <div className="relative sm:w-60">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <IconFilter className="w-3.5 h-3.5" />
            </div>
            <select
              value={dependenciaFiltro}
              onChange={e => setDep(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#409b84] focus:border-transparent text-sm bg-gray-50 focus:bg-white transition appearance-none"
            >
              <option value="">Todas las dependencias</option>
              {dependencias.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Filtro salón */}
          <select
            value={salonFiltro}
            onChange={e => setSalon(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#409b84] focus:border-transparent text-sm sm:w-44 bg-gray-50 focus:bg-white transition appearance-none"
          >
            <option value="">Todos los salones</option>
            {salones.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Toggle ausentes */}
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

        {/* Info resultados */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400">
            {loading ? 'Cargando...' : (
              <>
                <span className="font-semibold text-gray-600">{total.toLocaleString('es-MX')}</span>
                {' '}registros{hasFilters ? ' con los filtros aplicados' : ''}
              </>
            )}
          </span>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setDep(''); setSalon(''); setSoloAusentes(false) }}
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
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Asistente</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden lg:table-cell">Dependencia</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden md:table-cell">Salón</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: '#409b84', borderTopColor: 'transparent' }} />
                      <span className="text-xs text-gray-400">Cargando registros...</span>
                    </div>
                  </td>
                </tr>
              ) : asistentes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <IconUsers className="w-10 h-10 opacity-30" />
                      <span className="font-medium">Sin resultados</span>
                      <span className="text-xs">Intenta con otros términos de búsqueda</span>
                    </div>
                  </td>
                </tr>
              ) : (
                asistentes.map((a, i) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={`cursor-pointer hover:bg-[#409b84]/10 transition-colors group ${
                      i % 2 === 0 ? '' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {/* Avatar con iniciales */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          a.asistio ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {(a.nombres?.[0] || '?')}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 leading-tight">
                            {a.apellido_paterno} {a.apellido_materno}, {a.nombres}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{a.cargo || a.puesto || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-500 leading-tight block max-w-[220px]">{a.dependencia}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                        {a.salon || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {a.asistio ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          <IconCheck className="w-3 h-3" />
                          Presente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <IconX className="w-3 h-3" />
                          Ausente
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
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

      {/* Modal */}
      {selectedAsistente && (
        <AsistenteModal
          asistente={selectedAsistente}
          usuario={usuario}
          onClose={() => setSelected(null)}
          onActualizado={handleActualizado}
        />
      )}
    </div>
  )
}
