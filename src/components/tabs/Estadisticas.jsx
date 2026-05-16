import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { IconDownload, IconRefresh, IconUsers } from '../Icons'

// Genera siglas: toma la primera letra de cada palabra significativa (>2 chars)
function toSiglas(nombre) {
  if (!nombre) return '?'
  return nombre
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 6) || nombre.slice(0, 4).toUpperCase()
}

export default function Estadisticas({ usuario }) {
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [resetting, setResetting] = useState(false)
  const [confirm, setConfirm]     = useState(false)
  const isAdmin = usuario?.rol === 'super_admin'

  useEffect(() => { fetchStats() }, [])

  async function resetAsistencia() {
    setResetting(true)
    setConfirm(false)
    const { error } = await supabase
      .from('asistentes')
      .update({ asistio: false, fecha_asistencia: null, registrado_por: null })
      .neq('id', '00000000-0000-0000-0000-000000000000') // actualiza todos
    setResetting(false)
    if (!error) fetchStats()
    else alert('Error al reiniciar: ' + error.message)
  }

  async function fetchStats() {
    setLoading(true)

    // Supabase limita 1000 filas por defecto — paginamos para obtener todos
    async function fetchAll(query) {
      const PAGE = 1000
      let all = [], page = 0, done = false
      while (!done) {
        const { data, error } = await query.range(page * PAGE, (page + 1) * PAGE - 1)
        if (error || !data) break
        all = all.concat(data)
        done = data.length < PAGE
        page++
      }
      return all
    }

    const [todos, presentes] = await Promise.all([
      fetchAll(supabase.from('asistentes').select('dependencia, salon, asistio')),
      fetchAll(supabase.from('asistentes').select('dependencia, salon').eq('asistio', true)),
    ])

    if (!todos.length && !presentes.length) { setLoading(false); return }

    const total          = todos.length
    const totalPresentes = (presentes || []).length
    const totalAusentes  = total - totalPresentes

    const depMap = {}
    todos.forEach(a => {
      if (!depMap[a.dependencia]) depMap[a.dependencia] = { dependencia: a.dependencia, siglas: toSiglas(a.dependencia), Invitados: 0, Presentes: 0 }
      depMap[a.dependencia].Invitados++
    })
    ;(presentes || []).forEach(a => { if (depMap[a.dependencia]) depMap[a.dependencia].Presentes++ })
    const porDependencia = Object.values(depMap).sort((a, b) => b.Invitados - a.Invitados)

    const salonMap = {}
    todos.forEach(a => {
      const key = a.salon || 'Sin salón'
      if (!salonMap[key]) salonMap[key] = { salon: key, Invitados: 0, Presentes: 0 }
      salonMap[key].Invitados++
    })
    ;(presentes || []).forEach(a => {
      const key = a.salon || 'Sin salón'
      if (salonMap[key]) salonMap[key].Presentes++
    })
    const porSalon = Object.values(salonMap).sort((a, b) => b.Invitados - a.Invitados)

    setStats({ total, totalPresentes, totalAusentes, porDependencia, porSalon })
    setLoading(false)
  }

  function exportPDF() {
    if (!stats) return
    const doc = new jsPDF()
    const now = new Date().toLocaleString('es-MX')
    const pct = stats.total > 0 ? ((stats.totalPresentes / stats.total) * 100).toFixed(1) : '0.0'

    doc.setFontSize(18)
    doc.setTextColor(30, 64, 175)
    doc.text('STSEGOB — Reporte de Asistencia', 14, 22)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generado: ${now}`, 14, 30)
    doc.setFontSize(13)
    doc.setTextColor(0)
    doc.text('Resumen General', 14, 44)
    autoTable(doc, {
      startY: 48,
      head: [['Total Invitados', 'Asistentes', 'Ausentes', '% Asistencia']],
      body: [[stats.total, stats.totalPresentes, stats.totalAusentes, `${pct}%`]],
      headStyles: { fillColor: [30, 58, 138] },
    })
    doc.text('Asistencia por Dependencia', 14, doc.lastAutoTable.finalY + 14)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [['Dependencia', 'Invitados', 'Presentes', 'Ausentes', '%']],
      body: stats.porDependencia.map(d => [
        d.dependencia, d.Invitados, d.Presentes,
        d.Invitados - d.Presentes,
        d.Invitados > 0 ? `${((d.Presentes / d.Invitados) * 100).toFixed(1)}%` : '0.0%',
      ]),
      headStyles: { fillColor: [30, 58, 138] },
    })
    doc.addPage()
    doc.setFontSize(13)
    doc.text('Asistencia por Salón', 14, 20)
    autoTable(doc, {
      startY: 24,
      head: [['Salón', 'Invitados', 'Presentes', 'Ausentes', '%']],
      body: stats.porSalon.map(s => [
        s.salon, s.Invitados, s.Presentes,
        s.Invitados - s.Presentes,
        s.Invitados > 0 ? `${((s.Presentes / s.Invitados) * 100).toFixed(1)}%` : '0.0%',
      ]),
      headStyles: { fillColor: [30, 58, 138] },
    })
    doc.save(`reporte-asistencia-${Date.now()}.pdf`)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent" style={{ borderColor: '#409b84', borderTopColor: 'transparent' }} />
        <span className="text-sm text-gray-400">Cargando estadísticas...</span>
      </div>
    )
  }

  if (!stats) return <p className="text-center text-gray-500 py-20">Sin datos disponibles.</p>

  const pct     = stats.total > 0 ? ((stats.totalPresentes / stats.total) * 100).toFixed(1) : '0.0'
  const pieData = [
    { name: 'Presentes', value: stats.totalPresentes },
    { name: 'Ausentes',  value: stats.totalAusentes  },
  ]

  return (
    <div className="space-y-5">
      {/* Modal de confirmación reset */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Reiniciar asistencia</h3>
                <p className="text-xs text-gray-500 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Se marcará a <strong>todos los asistentes como ausentes</strong> y se borrarán las fechas de registro. ¿Continuar?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="flex-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-xl text-sm transition-colors">Cancelar</button>
              <button onClick={resetAsistencia} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl text-sm transition-colors">Sí, reiniciar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold text-gray-800">Estadísticas del evento</h2>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => setConfirm(true)} disabled={resetting}
              className="flex items-center gap-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium px-3 py-2 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50">
              {resetting
                ? <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              }
              Reiniciar asistencia
            </button>
          )}
          <button onClick={fetchStats} className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-medium px-3 py-2 rounded-xl transition-colors text-xs shadow-sm">
            <IconRefresh className="w-3.5 h-3.5" /> Actualizar
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-xs shadow-sm" style={{ backgroundColor: '#0e322e' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#26645b')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0e322e')}>
            <IconDownload className="w-3.5 h-3.5" /> Descargar PDF
          </button>
        </div>
      </div>

      {/* KPIs + Donut en una fila */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center">
          <div className="relative">
            <svg viewBox="0 0 120 120" className="w-36 h-36 -rotate-90">
              <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="16" />
              <circle cx="60" cy="60" r="48" fill="none" stroke="#409b84" strokeWidth="16"
                strokeDasharray={`${(parseFloat(pct) / 100) * 301.59} 301.59`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black" style={{ color: '#0e322e' }}>{pct}%</span>
              <span className="text-xs text-gray-400 font-medium">asistencia</span>
            </div>
          </div>
          <div className="mt-4 w-full space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#409b84' }}/><span className="text-gray-600">Presentes</span></div>
              <span className="font-bold" style={{ color: '#0e322e' }}>{stats.totalPresentes.toLocaleString('es-MX')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block"/><span className="text-gray-600">Ausentes</span></div>
              <span className="font-bold text-slate-500">{stats.totalAusentes.toLocaleString('es-MX')}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2"><IconUsers className="w-3.5 h-3.5 text-gray-400"/><span className="text-gray-600">Total</span></div>
              <span className="font-bold text-gray-700">{stats.total.toLocaleString('es-MX')}</span>
            </div>
          </div>
        </div>

        {/* KPI stack */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-4">
          {/* Barra progreso grande */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 rounded-2xl p-5 sm:p-6 text-white flex items-center justify-between gap-4" style={{ background: 'linear-gradient(to bottom right, #0e322e, #26645b)' }}>
            <div>
              <div className="text-xs font-medium text-white/70 uppercase tracking-widest mb-1">Progreso general</div>
              <div className="text-5xl font-black">{pct}<span className="text-2xl font-bold text-white/60">%</span></div>
              <div className="text-sm text-white/70 mt-1">{stats.totalPresentes.toLocaleString('es-MX')} de {stats.total.toLocaleString('es-MX')} asistentes</div>
            </div>
            <div className="flex-shrink-0 w-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3.5"
                  strokeDasharray={`${(parseFloat(pct) / 100) * 100} 100`} strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircleIcon className="text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-700">{stats.totalPresentes.toLocaleString('es-MX')}</div>
              <div className="text-xs text-gray-500 font-medium">Presentes · {pct}%</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ClockIcon className="text-slate-500" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-600">{stats.totalAusentes.toLocaleString('es-MX')}</div>
              <div className="text-xs text-gray-500 font-medium">Ausentes · {(100 - parseFloat(pct)).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla por dependencia */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Asistencia por Dependencia</h3>
          <span className="text-xs text-gray-400">{stats.porDependencia.length} dependencias</span>
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {stats.porDependencia.map((d, i) => {
            const p = d.Invitados > 0 ? (d.Presentes / d.Invitados) * 100 : 0
            const color = p >= 75 ? 'bg-emerald-500' : p >= 50 ? 'bg-[#409b84]' : p >= 25 ? 'bg-amber-400' : 'bg-red-400'
            return (
              <div key={d.dependencia} className="px-6 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-bold text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                    <span className="text-xs font-semibold text-gray-700 truncate" title={d.dependencia}>{d.dependencia}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-400">{d.Presentes}<span className="text-gray-300">/{d.Invitados}</span></span>
                    <span className={`text-xs font-bold w-11 text-right ${p >= 75 ? 'text-emerald-600' : p >= 50 ? 'text-[#26645b]' : p >= 25 ? 'text-amber-500' : 'text-red-500'}`}>
                      {p.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Por salón */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Asistencia por Salón</h3>
          <span className="text-xs text-gray-400">{stats.porSalon.length} salones</span>
        </div>
        <div className="p-4 sm:p-6 overflow-x-auto">
          <div style={{ minWidth: 280 }}>
          <ResponsiveContainer width="100%" height={Math.max(200, stats.porSalon.length * 52)}>
            <BarChart data={stats.porSalon} layout="vertical" margin={{ top: 0, right: 50, left: 70, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f8fafc" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="salon" width={70} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(64,155,132,0.07)' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12, padding: '10px 14px' }}
                labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}
              />
              <Bar dataKey="Invitados" name="Invitados" fill="#409b8430" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Presentes" name="Presentes" fill="#409b84" radius={[0, 4, 4, 0]}
                label={{ position: 'right', fontSize: 11, fill: '#26645b', fontWeight: 700 }} />
            </BarChart>
          </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 justify-center mt-4">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#409b8430', border: '1px solid #409b84' }}/><span className="text-xs text-gray-500">Invitados</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#409b84' }}/><span className="text-xs text-gray-500">Presentes</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckCircleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  )
}

function ClockIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  )
}
