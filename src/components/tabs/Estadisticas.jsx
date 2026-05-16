import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { IconDownload, IconRefresh, IconUsers } from '../Icons'

const PIE_COLORS = ['#3b82f6', '#e2e8f0']

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
    const [{ data: todos }, { data: presentes }] = await Promise.all([
      supabase.from('asistentes').select('dependencia, salon, asistio'),
      supabase.from('asistentes').select('dependencia, salon').eq('asistio', true),
    ])
    if (!todos) { setLoading(false); return }

    const total          = todos.length
    const totalPresentes = (presentes || []).length
    const totalAusentes  = total - totalPresentes

    const depMap = {}
    todos.forEach(a => {
      if (!depMap[a.dependencia]) depMap[a.dependencia] = { dependencia: a.dependencia, Invitados: 0, Presentes: 0 }
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
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
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
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-xl text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={resetAsistencia}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl text-sm transition-colors"
              >
                Sí, reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold text-gray-800">Estadísticas del evento</h2>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => setConfirm(true)}
              disabled={resetting}
              className="flex items-center gap-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium px-3 py-2 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50"
            >
              {resetting ? (
                <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Reiniciar asistencia
            </button>
          )}
          <button
            onClick={fetchStats}
            className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-medium px-3 py-2 rounded-xl transition-colors text-xs shadow-sm"
          >
            <IconRefresh className="w-3.5 h-3.5" />
            Actualizar
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 bg-blue-800 hover:bg-blue-900 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-xs shadow-sm"
          >
            <IconDownload className="w-3.5 h-3.5" />
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total invitados"
          value={stats.total}
          icon={<IconUsers className="w-5 h-5" />}
          color="blue"
          sub="registrados en el sistema"
        />
        <KpiCard
          label="Presentes"
          value={stats.totalPresentes}
          icon={<CheckCircleIcon />}
          color="green"
          sub={`${pct}% del total`}
        />
        <KpiCard
          label="Ausentes"
          value={stats.totalAusentes}
          icon={<ClockIcon />}
          color="slate"
          sub={`${(100 - parseFloat(pct)).toFixed(1)}% del total`}
        />
      </div>

      {/* Gráfico pastel + barra progreso */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-5">Asistencia General</h3>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                outerRadius={80}
                innerRadius={48}
                dataKey="value"
                paddingAngle={2}
              >
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => v.toLocaleString('es-MX')} />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex-shrink-0 text-center sm:text-left">
            <div className="text-6xl font-black text-blue-700 leading-none">{pct}%</div>
            <div className="text-gray-500 text-sm mt-2 font-medium">de asistencia</div>
            <div className="mt-4 space-y-2">
              <LegendItem label="Presentes" color="#3b82f6" value={stats.totalPresentes} />
              <LegendItem label="Ausentes"  color="#e2e8f0" value={stats.totalAusentes} textColor="text-gray-400" />
            </div>
          </div>
        </div>

        {/* Barra de progreso grande */}
        <div className="mt-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Progreso de asistencia</span>
            <span className="font-semibold text-blue-700">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Por dependencia */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-5">Por Dependencia</h3>
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={Math.max(280, stats.porDependencia.length * 36)}>
            <BarChart
              data={stats.porDependencia}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="dependencia"
                width={180}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Invitados" fill="#dbeafe" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Presentes" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Por salón */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-5">Por Salón</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.porSalon} margin={{ top: 0, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="salon" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Invitados" fill="#fde68a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Presentes" fill="#d97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon, color, sub }) {
  const colors = {
    blue:  { bg: 'bg-blue-50',  border: 'border-blue-100',  icon: 'bg-blue-100 text-blue-700',  text: 'text-blue-800'  },
    green: { bg: 'bg-green-50', border: 'border-green-100', icon: 'bg-green-100 text-green-700', text: 'text-green-800' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-100', icon: 'bg-slate-100 text-slate-500', text: 'text-slate-700' },
  }
  const c = colors[color]
  return (
    <div className={`rounded-2xl border-2 ${c.bg} ${c.border} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.icon}`}>
          {icon}
        </div>
      </div>
      <div className={`text-4xl font-black ${c.text}`}>{value.toLocaleString('es-MX')}</div>
      <div className="text-sm font-semibold text-gray-600 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function LegendItem({ label, color, value, textColor = 'text-gray-700' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-gray-500">{label}:</span>
      <span className={`text-xs font-bold ${textColor}`}>{value.toLocaleString('es-MX')}</span>
    </div>
  )
}

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  )
}
