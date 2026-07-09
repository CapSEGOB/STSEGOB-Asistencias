import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { partidoInfo, PARTIDOS_ORDEN } from '../../lib/partidos'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { IconDownload, IconRefresh, IconUsers, IconUserGroup } from '../Icons'

const DIA_LABEL = { 1: 'Día 1 (jue)', 2: 'Día 2 (vie)', 3: 'Día 3 (lun)', 4: 'Día 4 (mar)' }

// Días en orden para los reportes (incluye "sin día" al final).
const DIAS_REPORTE = [
  { dia: 1,    label: 'Día 1 (jue 09)' },
  { dia: 2,    label: 'Día 2 (vie 10)' },
  { dia: 3,    label: 'Día 3 (lun 13)' },
  { dia: 4,    label: 'Día 4 (mar 14)' },
  { dia: null, label: 'Sin día' },
]

const horaRegistro = f => f
  ? new Date(f).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : ''

const porMunicipio = (a, b) => (a.municipio || '').localeCompare(b.municipio || '', 'es')

// Trae todas las filas con detalle, paginando el límite de PostgREST.
async function fetchDetalle() {
  const PAGE = 1000
  let all = [], page = 0, done = false
  while (!done) {
    const { data, error } = await supabase
      .from('presidentes_municipales')
      .select('municipio, nombre, partido, telefono, responsable, dia, asistio, acompanante, confirmacion, fecha_asistencia')
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (error || !data) break
    all = all.concat(data)
    done = data.length < PAGE
    page++
  }
  return all
}

export default function Estadisticas({ usuario }) {
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [resetting, setResetting] = useState(false)
  const [confirm, setConfirm]     = useState(false)
  const [exporting, setExporting] = useState(null) // 'pdf' | 'excel' | null
  const isAdmin = usuario?.rol === 'super_admin'

  useEffect(() => { fetchStats() }, [])

  async function resetAsistencia() {
    setResetting(true)
    setConfirm(false)
    const { error } = await supabase
      .from('presidentes_municipales')
      .update({ asistio: false, acompanante: false, fecha_asistencia: null, registrado_por: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setResetting(false)
    if (!error) fetchStats()
    else alert('Error al reiniciar: ' + error.message)
  }

  async function fetchStats() {
    setLoading(true)

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

    const todos = await fetchAll(
      supabase.from('presidentes_municipales').select('dia, partido, asistio, acompanante, confirmacion')
    )

    if (!todos.length) { setStats(null); setLoading(false); return }

    const total          = todos.length
    const totalPresentes = todos.filter(p => p.asistio).length
    const totalAusentes  = total - totalPresentes
    const acompanantes   = todos.filter(p => p.asistio && p.acompanante).length

    // Por día (1-4 + sin día)
    const dias = [1, 2, 3, 4].map(d => {
      const grupo = todos.filter(p => p.dia === d)
      return { key: DIA_LABEL[d], Invitados: grupo.length, Presentes: grupo.filter(p => p.asistio).length }
    })
    const sinDia = todos.filter(p => p.dia == null)
    if (sinDia.length) dias.push({ key: 'Sin día', Invitados: sinDia.length, Presentes: sinDia.filter(p => p.asistio).length })
    const porDia = dias.filter(d => d.Invitados > 0)

    // Por partido
    const partMap = {}
    todos.forEach(p => {
      const key = (p.partido || 'Sin partido')
      if (!partMap[key]) partMap[key] = { partido: key, label: partidoInfo(p.partido).label, color: partidoInfo(p.partido).color, Invitados: 0, Presentes: 0 }
      partMap[key].Invitados++
      if (p.asistio) partMap[key].Presentes++
    })
    const orden = k => { const i = PARTIDOS_ORDEN.indexOf(k); return i === -1 ? 99 : i }
    const porPartido = Object.values(partMap).sort((a, b) => orden(a.partido) - orden(b.partido) || b.Invitados - a.Invitados)

    // RSVP
    const rsvpAsiste = todos.filter(p => /^ASISTE/i.test(p.confirmacion || '')).length
    const rsvpNo     = todos.filter(p => /NO ASISTE/i.test(p.confirmacion || '')).length
    const rsvpSin    = total - rsvpAsiste - rsvpNo

    setStats({ total, totalPresentes, totalAusentes, acompanantes, porDia, porPartido, rsvpAsiste, rsvpNo, rsvpSin })
    setLoading(false)
  }

  // Reporte PDF: resumen + listas de presentes/ausentes por día.
  async function exportPDF() {
    if (!stats) return
    setExporting('pdf')
    try {
      const rows = await fetchDetalle()
      const doc = new jsPDF()
      const now = new Date().toLocaleString('es-MX')
      const pct = stats.total > 0 ? ((stats.totalPresentes / stats.total) * 100).toFixed(1) : '0.0'

      doc.setFontSize(18); doc.setTextColor(14, 50, 46)
      doc.text('STSEGOB — Asistencia Presidentes Municipales', 14, 22)
      doc.setFontSize(10); doc.setTextColor(100)
      doc.text(`Generado: ${now}`, 14, 30)
      doc.setFontSize(13); doc.setTextColor(0)
      doc.text('Resumen General', 14, 44)
      autoTable(doc, {
        startY: 48,
        head: [['Total', 'Presentes', 'Ausentes', 'Acompañantes', '% Asistencia']],
        body: [[stats.total, stats.totalPresentes, stats.totalAusentes, stats.acompanantes, `${pct}%`]],
        headStyles: { fillColor: [14, 50, 46] },
      })
      doc.text('Asistencia por Día', 14, doc.lastAutoTable.finalY + 14)
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 18,
        head: [['Día', 'Presidentes', 'Presentes', 'Ausentes', '%']],
        body: stats.porDia.map(d => [
          d.key, d.Invitados, d.Presentes, d.Invitados - d.Presentes,
          d.Invitados > 0 ? `${((d.Presentes / d.Invitados) * 100).toFixed(1)}%` : '0.0%',
        ]),
        headStyles: { fillColor: [14, 50, 46] },
      })

      // Listas por día: presentes y ausentes
      for (const { dia, label } of DIAS_REPORTE) {
        const grupo = rows.filter(r => r.dia === dia).sort(porMunicipio)
        if (!grupo.length) continue
        const presentes = grupo.filter(r => r.asistio)
        const ausentes  = grupo.filter(r => !r.asistio)

        doc.addPage()
        doc.setFontSize(14); doc.setTextColor(14, 50, 46)
        doc.text(`${label}`, 14, 20)
        doc.setFontSize(10); doc.setTextColor(100)
        doc.text(`Presidentes: ${grupo.length}  ·  Presentes: ${presentes.length}  ·  Ausentes: ${ausentes.length}`, 14, 27)

        doc.setFontSize(12); doc.setTextColor(21, 128, 61)
        doc.text(`Asistieron (${presentes.length})`, 14, 37)
        autoTable(doc, {
          startY: 40,
          head: [['Municipio', 'Presidente', 'Partido', 'Teléfono', 'Responsable', 'Hora', 'Acomp.']],
          body: presentes.map(r => [
            r.municipio, r.nombre, partidoInfo(r.partido).label, r.telefono || '',
            r.responsable || '', horaRegistro(r.fecha_asistencia), r.acompanante ? 'Sí' : 'No',
          ]),
          styles: { fontSize: 8, cellPadding: 1.5 },
          headStyles: { fillColor: [21, 128, 61], fontSize: 8 },
        })

        doc.setFontSize(12); doc.setTextColor(185, 28, 28)
        doc.text(`No asistieron (${ausentes.length})`, 14, doc.lastAutoTable.finalY + 10)
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 13,
          head: [['Municipio', 'Presidente', 'Partido', 'Teléfono', 'Responsable', 'RSVP previo']],
          body: ausentes.map(r => [
            r.municipio, r.nombre, partidoInfo(r.partido).label, r.telefono || '',
            r.responsable || '', r.confirmacion || '',
          ]),
          styles: { fontSize: 8, cellPadding: 1.5 },
          headStyles: { fillColor: [185, 28, 28], fontSize: 8 },
        })
      }

      doc.save(`listas-presidentes-${now.replace(/[/:, ]/g, '-')}.pdf`)
    } finally {
      setExporting(null)
    }
  }

  // Reporte Excel: una pestaña por día con estado presente/ausente.
  async function exportExcel() {
    setExporting('excel')
    try {
      const rows = await fetchDetalle()
      const wb = XLSX.utils.book_new()
      for (const { dia, label } of DIAS_REPORTE) {
        const grupo = rows.filter(r => r.dia === dia)
        if (!grupo.length) continue
        // Presentes primero, luego ausentes; dentro, por municipio
        grupo.sort((a, b) => (a.asistio === b.asistio ? porMunicipio(a, b) : a.asistio ? -1 : 1))
        const data = grupo.map(r => ({
          Municipio: r.municipio,
          Presidente: r.nombre,
          Partido: partidoInfo(r.partido).label,
          Teléfono: r.telefono || '',
          Responsable: r.responsable || '',
          Estado: r.asistio ? 'Presente' : 'Ausente',
          'Hora registro': r.asistio ? horaRegistro(r.fecha_asistencia) : '',
          Acompañante: r.asistio ? (r.acompanante ? 'Sí' : 'No') : '',
          'RSVP previo': r.confirmacion || '',
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        ws['!cols'] = [
          { wch: 24 }, { wch: 30 }, { wch: 14 }, { wch: 16 },
          { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 11 }, { wch: 12 },
        ]
        XLSX.utils.book_append_sheet(wb, ws, label.replace(/[[\]:*?/\\]/g, '').slice(0, 31))
      }
      const now = new Date().toLocaleString('es-MX').replace(/[/:, ]/g, '-')
      XLSX.writeFile(wb, `listas-presidentes-${now}.xlsx`)
    } finally {
      setExporting(null)
    }
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

  const pct = stats.total > 0 ? ((stats.totalPresentes / stats.total) * 100).toFixed(1) : '0.0'

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
              Se marcará a <strong>todos los presidentes como ausentes</strong> (incluye acompañantes y fechas de registro). ¿Continuar?
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
        <h2 className="text-base font-bold text-gray-800">Estadísticas de la gira</h2>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => setConfirm(true)} disabled={resetting}
              className="flex items-center gap-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium px-3 py-2 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50">
              {resetting
                ? <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                : <IconRefresh className="w-3.5 h-3.5" />}
              Reiniciar asistencia
            </button>
          )}
          <button onClick={fetchStats} className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-medium px-3 py-2 rounded-xl transition-colors text-xs shadow-sm">
            <IconRefresh className="w-3.5 h-3.5" /> Actualizar
          </button>
          <button onClick={exportExcel} disabled={!!exporting}
            className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-4 py-2 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50">
            {exporting === 'excel'
              ? <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              : <IconDownload className="w-3.5 h-3.5" />}
            Descargar Excel
          </button>
          <button onClick={exportPDF} disabled={!!exporting}
            className="flex items-center gap-1.5 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50" style={{ backgroundColor: '#0e322e' }}>
            {exporting === 'pdf'
              ? <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <IconDownload className="w-3.5 h-3.5" />}
            Descargar PDF
          </button>
        </div>
      </div>

      {/* KPIs + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center">
          <div className="relative">
            <svg viewBox="0 0 120 120" className="w-36 h-36 -rotate-90">
              <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="16" />
              <circle cx="60" cy="60" r="48" fill="none" stroke="#409b84" strokeWidth="16"
                strokeDasharray={`${(parseFloat(pct) / 100) * 301.59} 301.59`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }} />
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
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-2 gap-3 lg:gap-4">
          <div className="col-span-2 rounded-2xl p-5 sm:p-6 text-white flex items-center justify-between gap-4" style={{ background: 'linear-gradient(to bottom right, #0e322e, #26645b)' }}>
            <div>
              <div className="text-xs font-medium text-white/70 uppercase tracking-widest mb-1">Progreso general</div>
              <div className="text-5xl font-black">{pct}<span className="text-2xl font-bold text-white/60">%</span></div>
              <div className="text-sm text-white/70 mt-1">{stats.totalPresentes.toLocaleString('es-MX')} de {stats.total.toLocaleString('es-MX')} presidentes</div>
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
              <IconUserGroup className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-700">{stats.acompanantes.toLocaleString('es-MX')}</div>
              <div className="text-xs text-gray-500 font-medium">Con acompañante</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">RSVP previo</div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-green-600 font-medium">Asiste</span><span className="font-bold text-green-700">{stats.rsvpAsiste}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-red-500 font-medium">No asiste</span><span className="font-bold text-red-600">{stats.rsvpNo}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 font-medium">Sin confirmar</span><span className="font-bold text-gray-500">{stats.rsvpSin}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Por día */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Asistencia por Día</h3>
        </div>
        <div className="p-4 sm:p-6 overflow-x-auto">
          <div style={{ minWidth: 280 }}>
            <ResponsiveContainer width="100%" height={Math.max(200, stats.porDia.length * 52)}>
              <BarChart data={stats.porDia} layout="vertical" margin={{ top: 0, right: 50, left: 20, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f8fafc" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="key" width={90} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(64,155,132,0.07)' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12, padding: '10px 14px' }}
                  labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }} />
                <Bar dataKey="Invitados" name="Presidentes" fill="#409b8430" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Presentes" name="Presentes" fill="#409b84" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fontSize: 11, fill: '#26645b', fontWeight: 700 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Por partido */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Asistencia por Partido</h3>
          <span className="text-xs text-gray-400">{stats.porPartido.length} partidos</span>
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {stats.porPartido.map((d, i) => {
            const p = d.Invitados > 0 ? (d.Presentes / d.Invitados) * 100 : 0
            return (
              <div key={d.partido} className="px-6 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-bold text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs font-semibold text-gray-700 truncate" title={d.label}>{d.label}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-400">{d.Presentes}<span className="text-gray-300">/{d.Invitados}</span></span>
                    <span className="text-xs font-bold w-11 text-right" style={{ color: d.color }}>{p.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, backgroundColor: d.color }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
